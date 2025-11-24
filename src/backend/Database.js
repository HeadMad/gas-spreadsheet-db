class Database {
/**
 * Initializes a new Database instance.
 * @param {string|GoogleAppsScript.Spreadsheet.Spreadsheet} ssid - The ID of the Google Spreadsheet or the Spreadsheet object itself.
 * @property {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - The associated Spreadsheet object.
 * @property {DatabaseTxSession|null} txSession - The associated transaction session object.
 */
  constructor(ssid) {
    this.ss = typeof ssid === 'string' ? SpreadsheetApp.openById(ssid) : ssid;
    this.txSession = null;
  }

  getSpreadsheet() { return this.ss; }

  getMetadata() { return Utils.createMetadataProxy(this.ss); }
  
/**
 * Returns an array of table names.
 * @return {Array<string>} An array of table names.
 */
  getTableNames() {
    return this.ss.getSheets().map(s => s.getName());
  }

/**
 * Returns a TableContext instance associated with the given table name or index.
 * @param {string|number} name - The name of the table or its index.
 * @return {TableContext|null} The TableContext instance associated with the table or null if not found.
 */
  getTable(name) {
    let sheet;
    if (typeof name === 'number') {
      sheet = this.ss.getSheets()[name];
    } else if (typeof name === 'string') {
      sheet = this.ss.getSheetByName(name);
    }
    if (!sheet) return null;
    return new TableContext(sheet, this);
  }

/**
 * Creates a new table with the given name and columns.
 * If the table is created in a transaction, it will be automatically committed when the transaction is committed.
 * @param {string} name - The name of the table.
 * @param {Array<string>} [columns] - The columns of the table.
 * @return {TableContext} The TableContext instance associated with the table.
 */
  createTable(name, columns) {
    const sheet = this.ss.insertSheet(name);
    if (this.txSession) this.txSession.created.push(sheet);
    const table = new TableContext(sheet, this);
    if (columns && Array.isArray(columns)) {
        table.setColumns(columns);
    }
    return table;
  }

/**
 * Deletes the table with the given name.
 * If the table is deleted in a transaction, it will be automatically rolled back when the transaction is rolled back.
 * @param {string} name - The name of the table to delete.
 */
  deleteTable(name) {
    const sheet = this.ss.getSheetByName(name);
    if(sheet) {
      this.notifyModification(sheet);
      this.ss.deleteSheet(sheet);
    }
  }

/**
 * Notifies the database that the sheet has been modified.
 * If the sheet is modified in a transaction, it will be automatically rolled back when the transaction is rolled back.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet that has been modified.
 */
  notifyModification(sheet) {
    if (!this.txSession) return;
    const sheetId = sheet.getSheetId();
    if (this.txSession.created.some(s => s.getSheetId() === sheetId)) return;
    if (this.txSession.backups[sheetId]) return;
    
    const sheetName = sheet.getName();
    const backupSheet = sheet.copyTo(this.ss);
    backupSheet.setName(`_TX_BKP_${Date.now()}_${sheetName}`);
    backupSheet.hideSheet();
    this.txSession.backups[sheetId] = { original: sheet, backup: backupSheet, originalName: sheetName };
  }



/**
 * Starts a transaction. Creates backups of modified sheets. Restores the state in case of an error.
 * @param {function(db)} callback - A function that takes a DB instance.
 * @param {object} [options] - Options.
 * @param {boolean} [options.useLock=true] - Whether to use a lock (default: true).
 * @param {number} [options.lockTimeout=30000] - Lock timeout in ms (default: 30000).
 */
  transaction(callback, options = {}) {
    // 1. Настройка блокировки
    const useLock = options.useLock !== false; // По умолчанию true
    const lockTimeout = options.lockTimeout || 30000;
    let lock = null;

    // 2. Попытка получить блокировку
    if (useLock) {
      lock = LockService.getScriptLock();
      try {
        lock.waitLock(lockTimeout);
      } catch (e) {
        throw new Error(`SpreadsheetDB: Не удалось получить блокировку транзакции за ${lockTimeout}мс. Повторите попытку.`);
      }
    }

    // 3. Подготовка состояния транзакции
    const activeSheetBefore = this.ss.getActiveSheet();
    this.txSession = { backups: {}, created: [] };

    try {
      // 4. Выполнение пользовательского кода
      callback(this);

      // 5. Успех (Commit): Удаляем временные бэкапы, так как изменения приняты
      Object.values(this.txSession.backups).forEach(r => { 
        try { this.ss.deleteSheet(r.backup); } catch (e) {} 
      });

    } catch (error) {
      // 6. Ошибка (Rollback): Восстанавливаем состояние
      console.error("TX Rollback:", error);

      // А. Удаляем таблицы, которые были созданы внутри транзакции
      this.txSession.created.forEach(s => { 
        try { this.ss.deleteSheet(s); } catch(e) {} 
      });

      // Б. Восстанавливаем измененные таблицы из бэкапов
      Object.values(this.txSession.backups).forEach(r => { 
          // Удаляем "испорченный" оригинал
          try { this.ss.deleteSheet(r.original); } catch(e) {} 
          // Возвращаем бэкапу оригинальное имя и показываем его
          try { r.backup.setName(r.originalName); r.backup.showSheet(); } catch(e) {}
      });

      // В. Возвращаем фокус на исходный лист
      const restored = this.ss.getSheetByName(activeSheetBefore.getName());
      if (restored) restored.activate();

      throw error; // Пробрасываем ошибку дальше

    } finally {
      // 7. Очистка сессии и снятие блокировки (всегда!)
      this.txSession = null;
      if (lock) {
        lock.releaseLock();
      }
    }
  }

}
