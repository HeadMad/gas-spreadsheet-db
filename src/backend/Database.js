/**
 * Database class for managing Google Spreadsheet as a NoSQL-like database.
 * Provides table management, transactions with ACID guarantees, and automatic context caching.
 */
class Database {
  /**
   * Initializes a new Database instance.
   * @param {string|GoogleAppsScript.Spreadsheet.Spreadsheet} ssid - The spreadsheet ID or Spreadsheet object itself.
   */
  constructor(ssid) {
    this.ss = typeof ssid === 'string' ? SpreadsheetApp.openById(ssid) : ssid;
    this.tableNames = this.ss.getSheets().map(s => s.getName());
    this._tables = new Map;
    this.txSessionCreated = null;
    this.txSessionBackups = null;
  }

  /**
   * Internal method to get or create a cached TableContext for a sheet.
   * Automatically registers new tables in active transactions.
   * @private
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to wrap.
   * @return {TableContext} The cached or newly created TableContext instance.
   */
  _getCheckedTable(sheet) {
    const id = sheet.getSheetId();

    if (this._tables.has(id))
      return this._tables.get(id);

    if (this.txSessionCreated)
      this.txSessionCreated.add(id);

    const table = new TableContext(sheet, this);
    this._tables.set(id, table);
    return table;
  }

  /**
   * Returns the underlying Spreadsheet object.
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} The Spreadsheet instance.
   */
  getSpreadsheet() { return this.ss; }

  /**
   * Returns a proxy object for managing database-level metadata.
   * Metadata is stored in Developer Metadata and persisted automatically.
   * @return {Proxy} A proxy object for reading/writing metadata. Call `.save()` to persist changes.
   * @example
   * const meta = db.getMetadata();
   * meta.version = '1.0.0';
   * meta.lastUpdated = Date.now();
   * meta.save();
   */
  getMetadata() { return Utils.createMetadataProxy(this.ss); }

  /**
   * Returns an array of all table names in the database.
   * @return {string[]} Array of table (sheet) names.
   * @example
   * const tables = db.getTableNames(); // ['users', 'orders', 'products']
   */
  getTableNames() {
    return this.ss.getSheets().map(s => s.getName());
  }

  /**
   * Returns a TableContext instance for the specified table.
   * Returns the same instance on subsequent calls (cached by sheet ID).
   * @param {string|number} name - The table name or zero-based index.
   * @return {TableContext|null} The TableContext instance, or null if the table doesn't exist.
   * @example
   * const users = db.getTable('users');
   * const firstTable = db.getTable(0);
   * 
   * @example
   * // Caching behavior
   * const users1 = db.getTable('users');
   * const users2 = db.getTable('users');
   * console.log(users1 === users2); // true
   */
  getTable(name) {
    let sheet;
    if (typeof name === 'number') {
      sheet = this.ss.getSheets()[name];
    } else if (typeof name === 'string') {
      sheet = this.ss.getSheetByName(name);
    }
    if (!sheet) return null;
    return this._getCheckedTable(sheet);
  }

  /**
   * Creates a new table with the specified name and optional columns.
   * If called within a transaction, the table will be automatically deleted on rollback.
   * The created table is automatically cached and registered in the active transaction (if any).
   * 
   * @param {string} name - The name of the new table (sheet name).
   * @param {string[]} [columns] - Optional array of column names. If provided, headers will be set automatically with bold formatting and frozen row.
   * @return {TableContext} The newly created TableContext instance.
   * 
   * @example
   * // Create table without columns
   * const users = db.createTable('users');
   * users.setColumns(['id', 'name', 'email']);
   * 
   * @example
   * // Create table with columns in one call
   * const orders = db.createTable('orders', ['id', 'userId', 'total', 'createdAt']);
   * 
   * @example
   * // Create table within transaction (auto-rollback on error)
   * db.transaction((db) => {
   *   const temp = db.createTable('temp_data', ['value']);
   *   temp.insertRow({ value: 'test' });
   *   throw new Error('Rollback'); // 'temp_data' will be deleted
   * });
   */
  createTable(name, columns) {
    const sheet = this.ss.insertSheet(name);
    const table = this._getCheckedTable(sheet);

    if (columns && Array.isArray(columns))
      table.setColumns(columns);

    return table;
  }

  /**
   * Deletes the table with the specified name.
   * If called within a transaction, the deletion will be backed up and can be rolled back on error.
   * Automatically invalidates and removes cached TableContext instances.
   * 
   * @param {string} name - The name of the table to delete.
   * 
   * @example
   * db.deleteTable('old_users');
   * 
   * @example
   * // Within transaction (will be restored on rollback)
   * db.transaction((db) => {
   *   db.deleteTable('users');
   *   throw new Error('Rollback'); // 'users' will be restored
   * });
   */
  deleteTable(name) {
    const sheet = this.ss.getSheetByName(name);
    if (sheet) {
      this.notifyModification(sheet);
      const id = sheet.getSheetId();
      this.ss.deleteSheet(sheet);
      if (!this._tables.has(id)) return;
      this._tables.get(id)._markAsInvalid();
      this._tables.delete(id);
    }
  }

  /**
   * Internal method to notify the database that a sheet has been modified.
   * Creates a hidden backup of the sheet if within an active transaction.
   * The backup is used for rollback in case of transaction failure.
   * 
   * @private
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet that has been modified.
   */
  notifyModification(sheet) {
    if (!this.txSessionCreated) return;

    const id = sheet.getSheetId();
    if (this.txSessionCreated.has(id) || this.txSessionBackups.has(id)) return;

    const sheetName = sheet.getName();
    const backupSheet = sheet.copyTo(this.ss);
    backupSheet.setName(`_TX_BKP_${Date.now()}_${sheetName}`);
    backupSheet.hideSheet();
    this.txSessionBackups.set(id, {
      backup: backupSheet,
      originalName: sheetName
    });
  }

  /**
   * Executes a callback within a transaction with ACID guarantees.
   * 
   * **Commit behavior (success):**
   * - All changes are persisted
   * - Backup sheets are deleted
   * 
   * **Rollback behavior (error):**
   * - Created tables are deleted
   * - Modified tables are restored from backups
   * - Deleted tables are restored (if backed up)
   * - All TableContext instances are updated/invalidated accordingly
   * 
   * **Concurrency:**
   * Uses script-level locking by default to prevent concurrent modifications.
   * Disable with `{useLock: false}` only if you're sure no concurrent access will occur.
   * 
   * @param {function(Database): void} callback - Function that receives the database instance and performs operations.
   * @param {Object} [options] - Transaction options.
   * @param {boolean} [options.useLock=true] - Whether to acquire a script lock (recommended for concurrent access).
   * @param {number} [options.lockTimeout=30000] - Lock acquisition timeout in milliseconds.
   * 
   * @throws {Error} If lock cannot be acquired within timeout.
   * @throws {Error} Re-throws any error from callback after performing rollback.
   * 
   * @example
   * // Basic transaction
   * db.transaction((db) => {
   *   const users = db.getTable('users');
   *   users.insertRow({ name: 'Alice', age: 30 });
   *   
   *   const orders = db.getTable('orders');
   *   orders.insertRow({ userId: 1, total: 99.99 });
   * });
   * 
   * @example
   * // Transaction with automatic rollback
   * try {
   *   db.transaction((db) => {
   *     const users = db.getTable('users');
   *     users.insertRow({ name: 'Alice' });
   *     
   *     const temp = db.createTable('temp', ['value']);
   *     temp.insertRow({ value: 'test' });
   *     
   *     throw new Error('Something went wrong');
   *     // Both operations rolled back, 'temp' deleted
   *   });
   * } catch (e) {
   *   console.log('Transaction failed:', e.message);
   * }
   * 
   * @example
   * // Transaction without lock (use with caution)
   * db.transaction((db) => {
   *   // Your operations...
   * }, { useLock: false });
   * 
   * @example
   * // Transaction with custom timeout
   * db.transaction((db) => {
   *   // Long-running operations...
   * }, { lockTimeout: 60000 }); // 60 seconds
   */
  transaction(callback, options = {}) {
    const useLock = options.useLock !== false;
    const lockTimeout = options.lockTimeout || 30000;
    let lock = null;

    // Acquire lock
    if (useLock) {
      lock = LockService.getScriptLock();
      try {
        lock.waitLock(lockTimeout);
      } catch (e) {
        throw new Error(`SpreadsheetDB: Failed to acquire transaction lock within ${lockTimeout}ms. Please retry.`);
      }
    }

    // Initialize transaction state
    const activeSheetNameBefore = this.ss.getActiveSheet().getName();
    this.txSessionCreated = new Set();
    this.txSessionBackups = new Map();

    try {
      // Execute user code
      callback(this);

      // COMMIT: Delete temporary backups
      for (const { backup } of this.txSessionBackups.values()) {
        try { this.ss.deleteSheet(backup); } catch (e) { }
      }

    } catch (error) {
      // ROLLBACK: Restore original state
      console.error("TX Rollback:", error);

      // A. Delete tables created during transaction
      for (const id of this.txSessionCreated) {
        try {
          const table = this._tables.get(id);
          if (table) {
            this.ss.deleteSheet(table.sheet);
            table._markAsInvalid();
            this._tables.delete(id);
          }
        } catch (e) { }
      }

      // B. Restore modified tables from backups
      for (const [id, { backup, originalName }] of this.txSessionBackups.entries()) {
        const table = this._tables.get(id);
        if (table) {
          try {
            this.ss.deleteSheet(table.sheet);
            backup.setName(originalName);
            backup.showSheet();
            table._updateSheet(backup, originalName);

            // ВАЖНО! Обновляем ключ в Map
            this._tables.delete(id); // удаляем старый ID
            this._tables.set(backup.getSheetId(), table); // добавляем новый ID

          } catch (e) { }
        }
      }

      // C. Restore focus to original sheet
      const restored = this.ss.getSheetByName(activeSheetNameBefore);
      if (restored) restored.activate();

      throw error;

    } finally {
      // Cleanup transaction state and release lock
      this.txSessionCreated = null;
      this.txSessionBackups = null;
      if (lock) {
        lock.releaseLock();
      }
    }
  }
}
