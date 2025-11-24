class TableContext {
  /**
   * Creates a new TableContext instance.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The associated Google Spreadsheet sheet.
   * @param {Database} dbReference - The associated Database instance.
   */
  constructor(sheet, dbReference) {
    this.sheet = sheet;
    this.db = dbReference;
    this._initHeaders();
  }

  /**
   * Notifies the database that the table has been modified.
   */
  _touch() { if (this.db) this.db.notifyModification(this.sheet); }

  /**
   * Initializes the table headers.
   * 
   * This method reads the values from the first row of the table and
   * stores them in the `headerValues` property. It also creates a
   * column map from the header values to their respective indices
   * and stores it in the `columnMap` property.
   */
  _initHeaders() {
    const lastCol = this.sheet.getLastColumn();
    this.headerValues = lastCol > 0 ? this.sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    this.columnMap = this.headerValues.reduce((acc, name, i) => { acc[name] = i; return acc; }, {});
  }


  /**
   * Returns the columns of the table as an array of strings.
   * @return {Array<string>} The columns of the table.
   */
  getColumns() {
    return [...this.headerValues];
  }

  /**
   * Sets the columns of the table.
   * @param {Array<string>} columns - The new columns of the table.
   * @return {TableContext} The TableContext instance.
   */
  setColumns(columns) {
    if (!Array.isArray(columns)) throw new Error("Columns must be an array of strings");
    this._touch();
    this.sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    this.sheet.setFrozenRows(1);
    this._initHeaders();
    return this;
  }

  /**
   * Returns the number of rows in the table.
   * @return {number} The number of rows in the table.
   */
  get count() { return Math.max(0, this.sheet.getLastRow() - 1); }

  /**
   * Returns the metadata of the table.
   * @return {Metadata} The metadata of the table.
   */
  getMetadata() { return Utils.createMetadataProxy(this.sheet); }

  /**
   * Sets the name of the table.
   * @param {string} name - The new name of the table.
   * @returns {TableContext} The TableContext instance.
   */
  setName(name) {
    this._touch();
    this.sheet.setName(name);
    return this;
  }


  /**
   * Calls the given handler for each row in the table.
   * @param {function} handler - The function to call for each row. It takes
   *  three arguments: the row object, the index of the row, and a
   *  function to stop the iteration.
   * @param {object} [options] - Optional parameters:
   *   - `limit`: The maximum number of rows to process. Defaults to 0 (no limit).
   *   - `offset`: The starting position of the iteration. Defaults to 0.
   *   - `reverse`: Whether to iterate in reverse order. Defaults to false.
   *   - `batchSize`: The number of rows to process in each iteration. Defaults to 100.
   * @return {any} The result of the handler function if it stopped the iteration.
   */
  each(handler, { limit = 0, offset = 0, reverse = false, batchSize = 100 } = {}) {
    const minRow = 2;
    const lastRow = this.sheet.getLastRow();

    // 1. Вычисляем стартовую позицию
    let cursor = reverse
      ? (offset >= 0 ? lastRow - offset : minRow - offset - 1)
      : (offset >= 0 ? minRow + offset : lastRow + offset + 1);

    // 2. Проверка границ
    if (cursor < minRow || cursor > lastRow) return undefined;

    // 3. Расчет количества
    const maxAvailable = reverse ? (cursor - minRow + 1) : (lastRow - cursor + 1);
    const totalToProcess = (limit > 0 && limit < maxAvailable) ? limit : maxAvailable;

    let processed = 0, stopped = false, result;
    const rowsToDelete = [];
    const stop = (val) => { stopped = true; result = val; };

    // 4. Цикл по батчам
    while (!stopped && processed < totalToProcess) {
      const count = Math.min(batchSize, totalToProcess - processed);
      const rangeTop = reverse ? (cursor - count + 1) : cursor;

      const range = this.sheet.getRange(rangeTop, 1, count, this.headerValues.length);
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

    if (rowsToDelete.length) {
      this._touch();
      Utils.groupConsecutive(rowsToDelete).forEach(g =>
        this.sheet.deleteRows(g[g.length - 1], g.length)
      );
    }

    return result;
  }

  /**
   * Inserts an array of rows into the table.
   * @param {Array} rows - Array of rows to insert. Each row can be either an array or an object.
   * If the row is an array, it will be inserted as is.
   * If the row is an object, it will be inserted with keys matching the column names.
   * If a key is not present in the object, it will be inserted as an empty string.
   * @returns {TableContext} The TableContext instance.
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

    const startRow = this.sheet.getLastRow() + 1;
    this.sheet.getRange(startRow, 1, grid.length, this.headerValues.length).setValues(grid);
    return this;
  }

  /**
   * Inserts a row into the table.
   * @param {Object} row - The row to insert. Each key in the object should match a column name.
   * If the key is not present in the object, it will be inserted as an empty string.
   * @returns {TableContext} The TableContext instance.
   */
  insertRow(row) { return this.insertRows([row]); }
}
