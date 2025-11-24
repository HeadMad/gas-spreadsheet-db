# SpreadsheetDB Library Summary for LLM

**SpreadsheetDB** is a Google Apps Script (GAS) ORM library that treats Google Sheets as a high-performance NoSQL database. It utilizes batch processing for reads/writes to bypass standard GAS performance limits and supports ACID-like transactions with rollback capabilities.

## API Reference

### 1. Static Methods (Library Entry Point)
*   **`SpreadsheetDB.init(ssid: string | Spreadsheet)`**: Initializes the database connection. Returns a `Database` instance.
*   **`SpreadsheetDB.addDatabaseMethod(name, handler)`**: Extends the `Database` class prototype.
*   **`SpreadsheetDB.addTableMethod(name, handler)`**: Extends the `TableContext` class prototype.

### 2. Database Class (Workbook Level)
*   **`getTable(name)`**: Returns `TableContext` or `null`.
*   **`createTable(name, columns: string[])`**: Creates a sheet with headers. Returns `TableContext`.
*   **`deleteTable(name)`**: Deletes the specified sheet.
*   **`getTableNames()`**: Returns `string[]` of all table names.
*   **`getSpreadsheet()`**: Returns the native `GoogleAppsScript.Spreadsheet.Spreadsheet` object.
*   **`getMetadata()`**: Returns a persistent storage object (Developer Metadata) for the workbook.
*   **`transaction(callback, options)`**: Executes code atomically with `LockService` and auto-rollback on error.
    *   `callback`: `(db: Database) => void`
    *   `options`: `{ useLock: boolean (default true), lockTimeout: number (default 30000) }`

### 3. TableContext Class (Sheet Level)
*   **`each(handler, options)`**: Iterates through rows. Returns value from `stop()` or `undefined`.
    *   `handler`: `(row: RowContext, index: number, stop: (val) => void) => void`
    *   `options`:
        *   `limit` (number, def: 0)
        *   `offset` (number, def: 0, supports negative for end-of-table)
        *   `reverse` (boolean, def: false)
        *   `batchSize` (number, def: 100)
*   **`insertRow(data)`**: Inserts a single object or array.
*   **`insertRows(data[])`**: Batch insertion (recommended for performance).
*   **`getColumns()` / `setColumns(cols)`**: specific header management.
*   **`setName(name)`**: Renames the sheet.
*   **`count`**: (Getter) Returns total row count.
*   **`getMetadata()`**: Returns persistent storage object for the specific sheet.

### 4. RowContext Class (Row Level)
*   **Property Access**: `row.ColumnName` (Read/Write). Cached until iteration ends.
*   **`remove()`**: Marks row for deletion (executed after loop).
*   **`toJSON()`**: Returns plain JS object `{Header: Value}`.
*   **`getData()`**: Returns raw array `[val1, val2]`.
*   **`getIndex()`**: Returns 1-based physical row index.

---

## Usage Examples

### Basic CRUD
```javascript
const db = SpreadsheetDB.init(SpreadsheetApp.getActiveSpreadsheet());

// 1. Get or Create Table
const users = db.getTable('Users') || db.createTable('Users', ['ID', 'Name', 'Role']);

// 2. Batch Insert
users.insertRows([
  { ID: 1, Name: 'Alice', Role: 'User' },
  { ID: 2, Name: 'Bob', Role: 'Admin' }
]);

// 3. Query, Update, Delete
users.each((row) => {
  // Update
  if (row.Name === 'Alice') {
    row.Role = 'SuperAdmin'; 
  }
  // Delete
  if (row.Name === 'Bob') {
    row.remove();
  }
});
```

### Advanced Querying (FindOne / Pagination)
```javascript
const table = db.getTable('Logs');

// Find specific record and stop immediately (performance optimization)
const target = table.each((row, i, stop) => {
  if (row.ID === 500) stop(row.toJSON());
}, { limit: 0 });

// Pagination: Get page 2 (size 20)
const page2 = [];
table.each(row => page2.push(row.toJSON()), { offset: 20, limit: 20 });

// Get last 5 items (tail)
const tail = [];
table.each(row => tail.push(row.toJSON()), { offset: -5 });
```

### Transactions (ACID)
```javascript
try {
  db.transaction((tx) => {
    const wallets = tx.getTable('Wallets');
    let senderFound = false;
    
    wallets.each((row, i, stop) => {
      if (row.User === 'Alice') {
        if (row.Balance < 100) throw new Error('Insufficient funds'); // Triggers Rollback
        row.Balance -= 100;
        senderFound = true;
      }
      if (row.User === 'Bob') {
        row.Balance += 100;
      }
    });
    
    if (!senderFound) throw new Error('Sender missing');
  });
} catch (e) {
  console.log('Transaction failed, data reverted:', e.message);
}
```

## Key Behaviors & Limitations
1.  **Formulas**: To write a formula, assign a string starting with `=`. Reading a formula cell returns the calculated value.
2.  **Header Sync**: Column mapping is cached on instantiation. If headers change externally during execution, re-instantiate the table.
3.  **Validation**: Accessing a non-existent column property on `RowContext` throws an error.
4.  **Performance**: Always prefer `insertRows` (array) over `insertRow` inside loops.