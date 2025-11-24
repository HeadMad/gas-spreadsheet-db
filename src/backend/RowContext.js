class BatchRowContext {
/**
 * Constructor for BatchRowContext.
 * @param {Object} rowData - The row data as an object with column names as keys and values as values.
 * @param {Object} columnMap - The column map as an object with column names as keys and column indices as values.
 * @param {number} rowIndex - The index of the row.
 * @param {function} onDirtyCallback - The callback to be called when the row data is modified.
 */
  constructor(rowData, columnMap, rowIndex, onDirtyCallback) {
    this._data = rowData;
    this._map = columnMap;
    this._rowIndex = rowIndex;
    this._onDirty = onDirtyCallback;
    this._isDeleted = false;

    return new Proxy(this, {

      get: (target, prop) => {
        // Системные методы
        if (prop === 'remove') return () => { target._isDeleted = true; };
        if (prop === 'isDeleted') return () => target._isDeleted;
        if (prop === 'getIndex') return () => target._rowIndex;
        if (prop === 'getData') return () => target._data;
        if (prop === 'toJSON') return () => {
           const obj = {};
           for (let key in target._map) obj[key] = target._data[target._map[key]];
           return obj;
        };
        // Для отладчика
        if (typeof prop === 'symbol' || prop === 'inspect' || prop === 'toString') return target[prop];

        // Доступ к данным
        if (prop in target._map) return target._data[target._map[prop]];
        
        throw new Error(`Column "${prop}" not found in table headers.`);
      },
      set: (target, prop, value) => {
        if (prop in target._map) {
          const idx = target._map[prop];
          if (target._data[idx] !== value) {
            target._data[idx] = value;
            if (target._onDirty) target._onDirty();
          }
          return true;
        }
        throw new Error(`Column "${prop}" not found in table headers.`);
      }
    });
  }
}
