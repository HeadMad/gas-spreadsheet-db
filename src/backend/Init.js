/**
 * @param {string|Spreadsheet} ssid ID таблицы или объект Spreadsheet
 * @return {Database}
 */
function init(ssid) {
  return new Database(ssid);
}

/**
 * Adds a custom method to the Database prototype.
 * This allows you to extend the Database class with custom logic.
 * @param {string} methodName - The name of the method to add.
 * @param {function} handler - The function to call when the method is invoked.
 * @example
 */
function addDatabaseMethod(methodName, handler) {
  Database.prototype[methodName] = handler;
}

/**
 * Adds a custom method to the TableContext prototype.
 * This allows you to extend the TableContext class with custom logic.
 * @param {string} methodName - The name of the method to add.
 * @param {function} handler - The function to call when the method is invoked.
 * @example
 * SpreadsheetDB.addTableMethod('sum', function(row) {
 *   const sum = row.reduce((acc, val) => acc + val, 0);
 *   return sum;
 * });
 */
function addTableMethod(methodName, handler) {
  TableContext.prototype[methodName] = handler;
}

