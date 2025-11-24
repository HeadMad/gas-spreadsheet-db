Here is the English translation of the documentation.

# 📚 SpreadsheetDB - A Google Apps Script Library

> **SpreadsheetDB** is an ORM library for Google Apps Script that transforms Google Sheets into a high-performance, NoSQL-like database. It solves the performance issues of standard `getValue/setValue` methods by using batch processing, and it supports transactions with rollback, smart navigation (slicing), metadata management, and plugins.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![GAS](https://img.shields.io/badge/platform-Google%20Apps%20Script-green.svg) ![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

<a name="toc"></a>
## 📖 Table of Contents

1. [🚀 Installation and Setup](#install)
2. [🚀 Quick Start](#quickstart)
3. [Static Methods [Library API]](#static_methods)
4. [Database Methods [Main Class]](#main_methods)
5. [TableContext Methods [Secondary Class]](#sub_methods)
6. [Working with RowContext [Data Objects]](#data_methods)
7. [Usage Examples](#examples)
8. [⚠️ Important Notes](#notes)
9. [🎯 Usage Tips](#tips)
10. [🐛 Known Limitations](#limits)

---

<a name="install"></a>
## 🚀 Installation and Setup
[menu](#toc) | [next](#quickstart) | [back](#toc)

### Install dependencies

```bash
npm install
```

### Configure Clasp

Install Clasp globally and log in:
```bash
npm install -g @google/clasp
clasp login
```

### Link to a Google Project
Create a `.clasp.json` file in the project root:
```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./dist"
}
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Local server (Vite). Frontend only (HMR), GAS calls are mocked. |
| `npm run build` | Full project build into the `dist/` folder. |
| `npm run push` | Build + upload code to Google Drive (Development Mode). |
| `npm run deploy` | **Full release cycle:** Build → Upload → Create a new version (Versioned Deployment). |


### Adding the library to your project:

1. Open your Google Apps Script project.
2. Click **Editor** → **Libraries** (`+` icon on the left).
3. Enter the library's Script ID.
4. Click **Look up**.
5. Select the latest version.
6. In the "Identifier" field, leave `SpreadsheetDB`.
7. Click **Add**.

---

<a name="quickstart"></a>
## 🚀 Quick Start
[menu](#toc) | [next](#static_methods) | [back](#install)

```javascript
function run() {
  // Connect to the database
  const db = SpreadsheetDB.init(SpreadsheetApp.getActiveSpreadsheet());
  
  // Create a table (if it doesn't exist)
  let users = db.getTable('Users');
  if (!users) {
    users = db.createTable('Users', ['Name', 'Role']);
  }

  // Insert a record
  users.insertRow({ Name: 'Alex', Role: 'Admin' });

  // Read and modify (Batch update)
  users.each((row) => {
    if (row.Name === 'Alex') {
      row.Role = 'SuperAdmin';
    }
  });
}
```

---

<a name="static_methods"></a>
## Static Methods [Library API]
[menu](#toc) | [next](#main_methods) | [back](#quickstart)

Methods called directly on the `SpreadsheetDB` object to initialize and configure extensions.

### `init(ssid)`

The main entry point. Creates a database instance linked to a specific Google Sheet.

**Parameters:**
- `ssid` _(string | Spreadsheet)_ - The spreadsheet ID (string) or a `SpreadsheetApp` object.

**Returns:** A `Database` class instance.

```javascript
const db = SpreadsheetDB.init('1AbCdEfGhIjKlMnOpQrStUvWxYz');
```

### `addDatabaseMethod(name, handler)`
Registers a plugin for the `Database` class. The method will be available on all database instances.
- `name` _(string)_ - The method name.
- `handler` _(function)_ - The implementation function. Inside the function, `this` refers to the `Database` instance.

```javascript
SpreadsheetDB.addDatabaseMethod('clearAll', function() {
  this.getTableNames().forEach(name => this.deleteTable(name));
});
```

### `addTableMethod(name, handler)`
Registers a plugin for the `TableContext` class. The method will be available on all tables.
- `name` _(string)_ - The method name.
- `handler` _(function)_ - The implementation function. Inside the function, `this` refers to the `TableContext` instance.

```javascript
SpreadsheetDB.addTableMethod('findOne', function(predicate) {
  return this.each((row, i, stop) => {
    if (predicate(row)) stop(row.toJSON());
  });
});
```

---

<a name="main_methods"></a>
## Database Methods [Main Class]
[menu](#toc) | [next](#sub_methods) | [back](#static_methods)

The `Database` class manages sheets, transactions, and global settings.

### `getTable(name)`
Gets an interface to work with a sheet.
- `name` _(string | number)_ - The sheet name or index.
- **Returns:** `TableContext` or `null`.

### `getTableNames()`
Returns a list of all sheet names.
- **Returns:** `string[]`.

### `createTable(name, columns)`
Creates a new sheet and formats the headers.
- `name` _(string)_ - The name of the new sheet.
- `columns` _(string[])_ - An array of headers (optional).
- **Returns:** `TableContext`.

### `deleteTable(name)`
Deletes a table (sheet).
- `name` _(string)_ - The name of the sheet to delete.

### `getSpreadsheet()`
Returns the original Google Spreadsheet object. Useful for calling native Google API methods.
- **Returns:** `GoogleAppsScript.Spreadsheet.Spreadsheet`.

### `getMetadata()`
Returns a Proxy object to work with workbook-level (file-level) **Developer Metadata**.
- **Returns:** `Object` (see metadata description below).

### `transaction(callback, options)`
Executes a set of operations atomically with support for locking (`ScriptLock`) and rollback on error.
**Parameters:**
- `callback` _(function(db))_: A function containing the transaction logic.
- `options` _(object)_:
    - `useLock` _(boolean, def: true)_: Use `LockService` to prevent concurrent access.
    - `lockTimeout` _(number, def: 30000)_: Lock wait timeout in milliseconds.

**Returns:** `void` (Throws an error on failure).

---

<a name="sub_methods"></a>
## TableContext Methods [Secondary Class]
[menu](#toc) | [next](#data_methods) | [back](#main_methods)

A class for working with a specific table (sheet).

### `each(handler, options)`
The main iterator.
**Parameters:**
- `handler` _(function(row, index, stop))_:
    - `row`: A [RowContext](#data_methods) object.
    - `index`: The physical row number.
    - `stop(val)`: A function to stop iteration. Returns `val` from `each`.
- `options` _(object)_:
    - `limit` _(number, def: 0)_: Maximum number of rows.
    - `offset` _(number, def: 0)_: Offset (+ from top, - from bottom).
    - `reverse` _(boolean, def: false)_: Iterate from bottom to top.
    - `batchSize` _(number, def: 100)_: Batch size for reading data.

**Returns:** The value from `stop()` or `undefined`.

### `insertRow(row)` / `insertRows(rows)`
Inserts data.
- `row`: `{Col: Val}` or `[Val1, Val2]`.
- **Returns:** `TableContext` (chainable).

### `getColumns()`
Returns an array of the table's headers.
- **Returns:** `string[]`.

### `setColumns(columns)`
Sets new headers.
- `columns` _(string[])_.

### `setName(name)`
Renames the table.
- `name` _(string)_.

### `count` (Getter)
The number of data rows.
- **Returns:** `number`.

### `getMetadata()`
Returns a Proxy object to work with sheet-level **Developer Metadata**.
- **Returns:** `Object`.
    - `.save()`: Saves changes to storage.
    - `.toJSON()`: Gets the object's data.

---

<a name="data_methods"></a>
## Working with RowContext [Data Objects]
[menu](#toc) | [next](#examples) | [back](#sub_methods)

The `row` object inside `each`.

### Read and Write
Access by column name.
```javascript
let val = row.Title;  // Read
row.Title = 'New';    // Write (cached)
```

### `remove()`
Marks the row for deletion (it will be deleted after the loop).

### `toJSON()`
Converts the row to a JS object `{Header: Value}`.

### `getIndex()`
Returns the row number (1-based).

### `getData()`
Returns the raw array of row values (`[val1, val2, ...]`). Useful for accessing data without relying on column names.

### `isDeleted()`
Returns `true` if the `remove()` method has been called on the row.

---

<a name="examples"></a>
## 💡 Usage Examples
[menu](#toc) | [next](#notes) | [back](#data_methods)

### 1. Basic CRUD (Create, Read, Update, Delete)
A standard scenario for working with a users table.

```javascript
function manageUsers() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActiveSpreadsheet());
  
  // Get or create the table
  const users = db.getTable('Users') || db.createTable('Users', ['ID', 'Name', 'Status']);

  // 1. CREATE: Bulk insert
  users.insertRows([
    { ID: 101, Name: 'Alice', Status: 'Active' },
    { ID: 102, Name: 'Bob', Status: 'Pending' },
    { ID: 103, Name: 'Charlie', Status: 'Banned' }
  ]);

  // 2. READ & UPDATE & DELETE: Single pass
  users.each(row => {
    // Update
    if (row.Status === 'Pending') {
      row.Status = 'Active';
    }
    // Delete
    if (row.Status === 'Banned') {
      row.remove();
    }
  });
}
```

### 2. Find One Record
Use `stop()` to break the loop immediately after finding the desired row. This significantly saves execution time.

```javascript
function findUserByEmail(email) {
  const db = SpreadsheetDB.init('SPREADSHEET_ID');
  
  // Pass the 3rd argument 'stop'
  const user = db.getTable('Users').each((row, i, stop) => {
    if (row.Email === email) {
      // Break the loop and return the data object
      stop(row.toJSON());
    }
  }, { limit: 0 }); // Search the entire table

  if (user) {
    Logger.log(`Found: ${user.Name}`);
  } else {
    Logger.log('User not found');
  }
}
```

### 3. Slicing and "Smart Navigation"
Get slices of data without loading the entire table.

```javascript
const logs = db.getTable('SystemLogs');

// A) Get the last 10 records (Log tail)
// offset: -10 means "start 10 rows from the end"
const recentLogs = [];
logs.each(row => {
  recentLogs.push(row.toJSON());
}, { offset: -10 });

// B) Get the "Top 5" best results (assuming the table is sorted in ascending order)
// reverse: true — iterate from the end (where max values are)
// limit: 5 — take only 5 items
const topScores = [];
db.getTable('Scores').each(row => {
  topScores.push(row.toJSON());
}, { reverse: true, limit: 5 });
```

### 4. Pagination
Implement paginated data output for a web interface or API.

```javascript
function getProductsPage(pageNumber, pageSize) {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const products = [];
  
  // pageNumber starts from 1
  const offset = (pageNumber - 1) * pageSize;

  db.getTable('Products').each(row => {
    products.push(row.toJSON());
  }, {
    offset: offset,  // Skip (page-1) pages
    limit: pageSize  // Take exactly one page size
  });

  return products;
}
```

### 5. Transactions with Rollback and Locking
Ensures data is not corrupted if an error occurs mid-process and prevents two users from modifying the same data simultaneously. For example, transferring money between accounts.

```javascript
function transferCredits(fromUser, toUser, amount) {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());

  try {
    // Attempt to execute the transaction (wait for lock up to 5 sec)
    db.transaction((tx) => {
      const wallets = tx.getTable('Wallets');
      let withdrawn = false;
      let deposited = false;

      wallets.each((row, i, stop) => {
        // Withdraw
        if (row.User === fromUser) {
          if (row.Balance < amount) throw new Error('Insufficient funds');
          row.Balance -= amount;
          withdrawn = true;
        }
        // Deposit
        if (row.User === toUser) {
          row.Balance += amount;
          deposited = true;
        }
        // If both are found, we can exit (optimization)
        if (withdrawn && deposited) stop();
      });

      if (!withdrawn || !deposited) {
        throw new Error('One of the users was not found');
      }
    }, { lockTimeout: 5000 });
    Logger.log('Transfer successful');

  } catch (e) {
    Logger.log('Transaction error: ' + e.message); 
    // At this point, the Wallets table has been restored to its original state
  }
}
```

### 6. Using Plugins
Example of registering a global method to find and remove duplicates.

```javascript
// 1. Register the method (usually in a config file)
SpreadsheetDB.addTableMethod('removeDuplicates', function(colName) {
  const seen = new Set();
  let removedCount = 0;
  
  this.each(row => {
    const val = row[colName];
    if (seen.has(val)) {
      row.remove();
      removedCount++;
    } else {
      seen.add(val);
    }
  });
  
  return removedCount;
});

// 2. Use it in business logic
function cleanUp() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const count = db.getTable('Emails').removeDuplicates('Address');
  Logger.log(`Removed duplicates: ${count}`);
}
```

### 7. Archiving Data (Moving to another table)
A classic task: move completed orders to an archive to keep the main table clean.

```javascript
function archiveCompletedOrders() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  
  // Use a transaction to avoid data loss on failure
  db.transaction((tx) => {
    const activeOrders = tx.getTable('Orders');
    // Create an archive with the same columns if it doesn't exist
    const archive = tx.getTable('Orders_Archive') || 
                    tx.createTable('Orders_Archive', activeOrders.getColumns());

    activeOrders.each((row) => {
      if (row.Status === 'Done') {
        // 1. Copy data to the archive
        archive.insertRow(row.toJSON());
        // 2. Mark for deletion from the source table
        row.remove();
      }
    });
  });
}
```

### 8. VLOOKUP Alternative (Joining Tables)
How to efficiently enrich one table with data from another (e.g., add a product price to an order by its ID).
**Important:** Do not nest `each` loops inside another `each` — it's slow. Use a Map/Object to cache the lookup table.

```javascript
function enrichOrders() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const productsTable = db.getTable('Products');
  const ordersTable = db.getTable('Orders');

  // 1. Create a price lookup map: { 'Prod_ID_1': 100, 'Prod_ID_2': 500 }
  const priceMap = {};
  productsTable.each(row => {
    priceMap[row.ID] = row.Price;
  });

  // 2. Iterate through orders and add the price
  ordersTable.each(row => {
    // If the price is not yet filled in
    if (!row.Price && priceMap[row.ProductID]) {
      row.Price = priceMap[row.ProductID];
      row.Total = row.Price * row.Quantity; // Calculate the total right away
    }
  });
}
```

### 9. Cleaning Up Logs by Date (Date Filtering)
Deleting records that are older than 30 days. Demonstrates working with `Date` objects.

```javascript
function cleanupOldLogs() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago from today

  db.getTable('Logs').each(row => {
    // row.Timestamp returns a Date object (if the cell is a date)
    // or a string (if it's text). It's better to be safe:
    const logDate = new Date(row.Timestamp);
    
    if (logDate < cutoffDate) {
      row.remove();
    }
  });
}
```

### 10. Bulk Import from an External API
An example of how to load data from a JSON source as quickly as possible using `insertRows` (batch insert).

```javascript
function syncFromCRM() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const crmData = UrlFetchApp.fetch('https://api.example.com/leads').getContentText();
  const leadsArray = JSON.parse(crmData); // [{name: '..', email: '..'}, ...]

  const table = db.getTable('Leads');

  // Option A: Full overwrite (delete old, insert new)
  /* 
  table.each(r => r.remove()); // Clear table
  table.insertRows(leadsArray); 
  */

  // Option B: Add only new leads (check for duplicates)
  // First, collect existing emails for a quick check
  const existingEmails = new Set();
  table.each(row => existingEmails.add(row.Email));

  const newRows = [];
  leadsArray.forEach(lead => {
    if (!existingEmails.has(lead.email)) {
      newRows.push({
        Email: lead.email,
        Name: lead.name,
        ImportedAt: new Date()
      });
    }
  });

  if (newRows.length > 0) {
    table.insertRows(newRows); // Insert as a batch!
    Logger.log(`Added ${newRows.length} new leads.`);
  }
}
```

### 11. Data Aggregation (Reporting)
Calculating sums and grouping without formulas (a code-based Pivot Table equivalent).

```javascript
function generateReport() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  
  // Object to store totals: { 'ManagerA': 1500, 'ManagerB': 2000 }
  const salesByManager = {};

  db.getTable('Sales').each(row => {
    const manager = row.Manager;
    const amount = Number(row.Amount) || 0;

    if (!salesByManager[manager]) {
      salesByManager[manager] = 0;
    }
    salesByManager[manager] += amount;
  });

  // Output the result (e.g., to another table)
  const reportData = Object.keys(salesByManager).map(mgr => ({
    Manager: mgr,
    TotalSales: salesByManager[mgr]
  }));
  
  const reportTable = db.getTable('Report') || db.createTable('Report', ['Manager', 'TotalSales']);
  
  // Clear the old report and write the new one
  // (Use a 'clearAll' plugin if available, or just delete rows)
  reportTable.each(r => r.remove()); 
  reportTable.insertRows(reportData);
}
```

---

<a name="notes"></a>
## ⚠️ Important Notes
[menu](#toc) | [next](#tips) | [back](#examples)

1.  **Header Synchronization**: The library initializes the column map when creating a `TableContext`. If you manually change headers in Google Sheets while a script is running, you need to re-create the table instance.
2.  **Validation**: Accessing `row.MissingColumn` will throw a `Column not found` error. This is a safeguard against typos.
3.  **Metadata**: `getMetadata()` uses Google Developer Metadata. This data is not visible on the sheet; it is "embedded" in the file/sheet.

---

<a name="tips"></a>
## 🎯 Usage Tips
[menu](#toc) | [next](#limits) | [back](#notes)

### Performance
Use `insertRows` (with an array) instead of `insertRow` (single) in a loop.

```javascript
// ✅ Fast
const newRows = data.map(item => ({ Name: item.name }));
table.insertRows(newRows);
```

### Extensibility
Use the static `SpreadsheetDB.addTableMethod` method to create reusable functions.

---

<a name="limits"></a>
## 🐛 Known Limitations
[menu](#toc) | [back](#tips)

1.  **Formulas**: When reading via `row.Col`, you get the calculated value. To write a formula, assign a string that starts with `=` (e.g., `row.Total = '=SUM(A1:B1)'`).
2.  **Quotas**: The library optimizes requests, but Google's limits (execution time, daily read/write operations) still apply.