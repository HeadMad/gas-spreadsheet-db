/**
 * TableContext class representing a single table (sheet) in the database.
 * Provides methods for CRUD operations, iteration, and metadata management.
 * Instances are cached by the Database class and reused across calls.
 */
class TableContext {
  /**
   * Creates a new TableContext instance.
   * Note: Typically created internally by Database.getTable() or Database.createTable().
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The underlying Google Spreadsheet sheet.
   * @param {Database} dbReference - Reference to the parent Database instance.
   */
  constructor(sheet, dbReference) {
    this.db = dbReference;
    this._invalid = false;
    this._updateSheet(sheet);
  }

  /**
   * Returns the underlying Sheet object.
   * @return {GoogleAppsScript.Spreadsheet.Sheet} The sheet instance.
   * @throws {Error} If the TableContext has been invalidated (e.g., after table deletion or rollback).
   */
  get sheet() {
    if (this._invalid) {
      throw new Error(
        `TableContext for "${this._name}" is no longer valid. ` +
        `Get a fresh reference: db.getTable("${this._name}")`
      );
    }
    return this._sheet;
  }

  /**
   * Returns the name of the table.
   * @return {string} The table name.
   */
  get name() {
    return this._name;
  }

  /**
   * Internal method to update the sheet reference and reinitialize headers.
   * Used during transaction rollback to point to the restored backup sheet.
   * @private
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The new sheet instance.
   * @param {string} [name] - Optional name override (defaults to sheet.getName()).
   */
  _updateSheet(sheet, name) {
    this._sheet = sheet;
    this._name = name ?? sheet.getName();
    this._initHeaders();
  }

  /**
   * Internal method to mark this TableContext as invalid.
   * Called when the table is deleted or the context should no longer be used.
   * Releases all references to allow garbage collection.
   * @private
   */
  _markAsInvalid() {
    if (this._invalid) return;
    
    this._invalid = true;
    this._sheet = null;
    this.db = null;
    this.headerValues = null;
    this.columnMap = null;
  }

  /**
   * Internal method to notify the database that the table has been modified.
   * Triggers backup creation if within an active transaction.
   * @private
   */
  _touch() { 
    if (this.db) this.db.notifyModification(this._sheet); 
  }

  /**
   * Internal method to initialize or refresh the table headers.
   * Reads the first row and builds a column name → index mapping.
   * @private
   */
  _initHeaders() {
    const lastCol = this._sheet.getLastColumn();
    this.headerValues = lastCol > 0 ? this._sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    this.columnMap = this.headerValues.reduce((acc, name, i) => { acc[name] = i; return acc; }, {});
  }

  /**
   * Returns a copy of the table's column names.
   * @return {string[]} Array of column names from the header row.
   * @example
   * const columns = table.getColumns(); // ['id', 'name', 'email']
   */
  getColumns() {
    return [...this.headerValues];
  }

  /**
   * Sets the table columns (replaces the header row).
   * The header row is automatically formatted with bold font and frozen.
   * @param {string[]} columns - Array of column names.
   * @return {TableContext} This instance for method chaining.
   * @throws {Error} If columns is not an array.
   * @example
   * table.setColumns(['id', 'name', 'email', 'createdAt']);
   */
  setColumns(columns) {
    if (!Array.isArray(columns)) throw new Error("Columns must be an array of strings");
    this._touch();
    this._sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    this._sheet.setFrozenRows(1);
    this._initHeaders();
    return this;
  }

  /**
   * Returns the number of data rows in the table (excluding the header row).
   * @return {number} The count of rows.
   */
  get count() { 
    return Math.max(0, this._sheet.getLastRow() - 1); 
  }

  /**
   * Returns a proxy object for managing table-level metadata.
   * Metadata is stored in Developer Metadata and persisted automatically.
   * @return {Proxy} A proxy object for reading/writing metadata. Call `.save()` to persist changes.
   * @example
   * const meta = table.getMetadata();
   * meta.lastSync = new Date().toISOString();
   * meta.save();
   */
  getMetadata() { 
    return Utils.createMetadataProxy(this._sheet); 
  }

  /**
   * Sets the name of the table (renames the sheet).
   * @param {string} name - The new table name.
   * @return {TableContext} This instance for method chaining.
   * @example
   * table.setName('users_v2');
   */
  setName(name) {
    this._touch();
    this._sheet.setName(name);
    this._name = name;
    return this;
  }

  /**
   * Iterates over table rows in batches, calling the handler for each row.
   * Supports filtering, pagination, reverse iteration, and early stopping.
   * Automatically handles updates (dirty tracking) and deletions (batch deletion).
   * 
   * @param {function(BatchRowContext, number, function): void} handler - Callback receiving:
   *   - row: BatchRowContext with column name access (e.g., row.name, row.age)
   *   - index: 1-based row number in the sheet
   *   - stop: Function to stop iteration early and return a value
   * @param {Object} [options] - Iteration options.
   * @param {number} [options.limit=0] - Maximum number of rows to process (0 = no limit).
   * @param {number} [options.offset=0] - Number of rows to skip from start/end (supports negative values).
   * @param {boolean} [options.reverse=false] - Whether to iterate in reverse order (bottom to top).
   * @param {number} [options.batchSize=100] - Number of rows to fetch per API call (performance tuning).
   * @return {*} The value passed to stop(), or undefined if iteration completed normally.
   * 
   * @example
   * // Update all adult users
   * table.each((row) => {
   *   if (row.age >= 18) {
   *     row.status = 'adult';
   *   }
   * });
   * 
   * @example
   * // Find first user named 'Alice'
   * const alice = table.each((row, index, stop) => {
   *   if (row.name === 'Alice') {
   *     stop(row.toJSON());
   *   }
   * });
   * 
   * @example
   * // Delete inactive users (reverse to avoid index shifting issues)
   * table.each((row) => {
   *   if (!row.isActive) {
   *     row.remove();
   *   }
   * }, { reverse: true });
   * 
   * @example
   * // Process last 10 rows
   * table.each((row) => {
   *   console.log(row.name);
   * }, { limit: 10, reverse: true });
   */
  each(handler, { limit = 0, offset = 0, reverse = false, batchSize = 100 } = {}) {
    const minRow = 2;
    const lastRow = this._sheet.getLastRow();

    // Calculate starting position
    let cursor = reverse
      ? (offset >= 0 ? lastRow - offset : minRow - offset - 1)
      : (offset >= 0 ? minRow + offset : lastRow + offset + 1);

    // Boundary check
    if (cursor < minRow || cursor > lastRow) return undefined;

    // Calculate total rows to process
    const maxAvailable = reverse ? (cursor - minRow + 1) : (lastRow - cursor + 1);
    const totalToProcess = (limit > 0 && limit < maxAvailable) ? limit : maxAvailable;

    let processed = 0, stopped = false, result;
    const rowsToDelete = [];
    const stop = (val) => { stopped = true; result = val; };

    // Batch processing loop
    while (!stopped && processed < totalToProcess) {
      const count = Math.min(batchSize, totalToProcess - processed);
      const rangeTop = reverse ? (cursor - count + 1) : cursor;

      const range = this._sheet.getRange(rangeTop, 1, count, this.headerValues.length);
      const values = range.getValues();
      let dirty = false;

      for (let i = 0; i < count; i++) {
        if (stopped) break;

        const valIdx = reverse ? (count - 1 - i) : i;
        const realRow = rangeTop + valIdx;

        const row = new BatchRowContext(values[valIdx], this.columnMap, realRow, () => dirty = true);
        handler(row, realRow, stop);

        if (row.isDeleted()) rowsToDelete.push(realRow);
        processed++;
      }

      if (dirty) { this._touch(); range.setValues(values); }
      cursor += reverse ? -count : count;
    }

    // Batch delete marked rows
    if (rowsToDelete.length) {
      this._touch();
      Utils.groupConsecutive(rowsToDelete).forEach(g =>
        this._sheet.deleteRows(g[g.length - 1], g.length)
      );
    }

    return result;
  }

  /**
   * Inserts multiple rows into the table at the end.
   * Rows can be arrays (positional values) or objects (keyed by column names).
   * Missing object keys are filled with empty strings.
   * 
   * @param {Array<Array|Object>} rows - Array of rows to insert.
   * @return {TableContext} This instance for method chaining.
   * 
   * @example
   * // Insert as objects
   * table.insertRows([
   *   { name: 'Alice', age: 30 },
   *   { name: 'Bob', age: 25 }
   * ]);
   * 
   * @example
   * // Insert as arrays (must match column order)
   * table.insertRows([
   *   [1, 'Alice', 30],
   *   [2, 'Bob', 25]
   * ]);
   */
  insertRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return this;
    this._touch();

    const grid = rows.map((row) => {
      if (Array.isArray(row)) return row;
      if (typeof row === 'object') {
        return this.headerValues.map(col => row[col] !== undefined ? row[col] : '');
      }
      return [];
    });

    const startRow = this._sheet.getLastRow() + 1;
    this._sheet.getRange(startRow, 1, grid.length, this.headerValues.length).setValues(grid);
    return this;
  }

  /**
   * Inserts a single row into the table at the end.
   * Convenience method that calls insertRows() internally.
   * 
   * @param {Array|Object} row - The row to insert (array or object).
   * @return {TableContext} This instance for method chaining.
   * 
   * @example
   * table.insertRow({ name: 'Alice', age: 30 });
   */
  insertRow(row) { 
    return this.insertRows([row]); 
  }
}
