# 📚 SpreadsheetDB - Google Apps Script Библиотека

> **SpreadsheetDB** — это ORM-библиотека для Google Apps Script, превращающая Google Таблицы в производительную NoSQL-подобную базу данных. Она решает проблему медленной работы стандартных методов `getValue/setValue` за счет пакетной обработки (batch processing), поддерживает транзакции с откатом (rollback), "умную" навигацию (slicing), работу с метаданными и плагины.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![GAS](https://img.shields.io/badge/platform-Google%20Apps%20Script-green.svg) ![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

<a name="toc"></a>
## 📖 Содержание

1. [🚀 Установка и настройка](#install)
2. [🚀 Быстрый старт](#quickstart)
3. [Статические методы [API Библиотеки]](#static_methods)
4. [Методы Database [Главный Класс]](#main_methods)
5. [Методы TableContext [Вторичный Класс]](#sub_methods)
6. [Работа с RowContext [Объекты Данных]](#data_methods)
7. [Примеры использования](#examples)
8. [⚠️ Важные замечания](#notes)
9. [🎯 Советы по использованию](#tips)
10. [🐛 Известные ограничения](#limits)

---

<a name="install"></a>
## 🚀 Установка и настройка
[меню](#toc) | [далее](#quickstart) | [назад](#toc)

### Установите зависимости

```bash
npm install
```

### Настройте Clasp

Установите Clasp глобально и авторизуйтесь:
```bash
npm install -g @google/clasp
clasp login
```

### Свяжите с проектом Google
Создайте файл `.clasp.json` в корне проекта:
```json
{
  "scriptId": "ВАШ_SCRIPT_ID",
  "rootDir": "./dist"
}
```

### Команды (Scripts)

| Команда | Описание |
| :--- | :--- |
| `npm run dev` | Локальный сервер (Vite). Только фронтенд (HMR), вызовы к GAS заглушены. |
| `npm run build` | Полная сборка проекта в папку `dist/`. |
| `npm run push` | Сборка + загрузка кода на Google Drive (Режим разработки). |
| `npm run deploy` | **Полный цикл релиза:** Сборка → Загрузка → Создание новой версии (Versioned Deployment). |


### Подключение библиотеки в свой проект:

1. Откройте ваш проект Google Apps Script
2. Нажмите **Редактор** → **Библиотеки** (значок `+` слева)
3. Введите Script ID скрипта библиотеки.
4. Нажмите **Найти**
5. Выберите последнюю версию
6. В поле "Идентификатор" оставьте `SpreadsheetDB`
7. Нажмите **Добавить**

---

<a name="quickstart"></a>
## 🚀 Быстрый старт
[меню](#toc) | [далее](#static_methods) | [назад](#install)

```javascript
function run() {
  // Подключение к БД
  const db = SpreadsheetDB.init(SpreadsheetApp.getActiveSpreadsheet());
  
  // Создаем таблицу (если её нет)
  let users = db.getTable('Users');
  if (!users) {
    users = db.createTable('Users', ['Name', 'Role']);
  }

  // Добавляем запись
  users.insertRow({ Name: 'Alex', Role: 'Admin' });

  // Читаем и меняем (Batch update)
  users.each((row) => {
    if (row.Name === 'Alex') {
      row.Role = 'SuperAdmin';
    }
  });
}
```

---

<a name="static_methods"></a>
## Статические методы [API Библиотеки]
[меню](#toc) | [далее](#main_methods) | [назад](#quickstart)

Методы, вызываемые непосредственно у объекта `SpreadsheetDB` для инициализации и настройки расширений.

### `init(ssid)`

Основная точка входа. Создает экземпляр базы данных, привязанный к конкретной Google Таблице.

**Параметры:**
- `ssid` _(string | Spreadsheet)_ - ID таблицы (строка) или объект `SpreadsheetApp`.

**Возвращает:** Экземпляр класса `Database`.

```javascript
const db = SpreadsheetDB.init('1AbCdEfGhIjKlMnOpQrStUvWxYz');
```

### `addDatabaseMethod(name, handler)`
Регистрирует плагин для класса `Database`. Метод появится у всех экземпляров базы данных.
- `name` _(string)_ - Название метода.
- `handler` _(function)_ - Функция реализации. Внутри функции `this` указывает на экземпляр `Database`.

```javascript
SpreadsheetDB.addDatabaseMethod('clearAll', function() {
  this.getTableNames().forEach(name => this.deleteTable(name));
});
```

### `addTableMethod(name, handler)`
Регистрирует плагин для класса `TableContext`. Метод появится у всех таблиц.
- `name` _(string)_ - Название метода.
- `handler` _(function)_ - Функция реализации. Внутри функции `this` указывает на экземпляр `TableContext`.

```javascript
SpreadsheetDB.addTableMethod('findOne', function(predicate) {
  return this.each((row, i, stop) => {
    if (predicate(row)) stop(row.toJSON());
  });
});
```

---

<a name="main_methods"></a>
## Методы Database [Главный Класс]
[меню](#toc) | [далее](#sub_methods) | [назад](#static_methods)

Класс `Database` управляет листами, транзакциями и глобальными настройками.

### `getTable(name)`
Получает интерфейс для работы с листом.
- `name` _(string | number)_ - Имя листа или индекс.
- **Возвращает:** `TableContext` или `null`.

### `getTableNames()`
Возвращает список имен всех листов.
- **Возвращает:** `string[]`.

### `createTable(name, columns)`
Создает новый лист, форматирует заголовки.
- `name` _(string)_ - Имя нового листа.
- `columns` _(string[])_ - Массив заголовков (опционально).
- **Возвращает:** `TableContext`.

### `deleteTable(name)`
Удаляет таблицу (лист).
- `name` _(string)_ - Имя удаляемого листа.

### `getSpreadsheet()`
Возвращает исходный объект Google Spreadsheet. Полезно, если нужно вызвать нативные методы Google API.
- **Возвращает:** `GoogleAppsScript.Spreadsheet.Spreadsheet`.

### `getMetadata()`
Возвращает Proxy-объект для работы с **Developer Metadata** уровня книги (файла).
- **Возвращает:** `Object` (см. описание метаданных ниже).

Вот описание метода в требуемом стиле:

### `transaction(callback, options)`
Выполняет набор операций атомарно с поддержкой блокировок (ScriptLock) и откатом (Rollback) при ошибке.
**Параметры:**
- `callback` _(function(db))_: Функция с логикой транзакции.
- `options` _(object)_:
    - `useLock` _(boolean, def: true)_: Использовать `LockService` для защиты от конкурентного доступа.
    - `lockTimeout` _(number, def: 30000)_: Время ожидания блокировки в мс.

**Возвращает:** `void` (Пробрасывает ошибку при сбое).

---

<a name="sub_methods"></a>
## Методы TableContext [Вторичный Класс]
[меню](#toc) | [далее](#data_methods) | [назад](#main_methods)

Класс для работы с конкретной таблицей (листом).

### `each(handler, options)`
Основной итератор.
**Параметры:**
- `handler` _(function(row, index, stop))_:
    - `row`: Объект [RowContext](#data_methods).
    - `index`: Физический номер строки.
    - `stop(val)`: Функция остановки. Возвращает `val` из `each`.
- `options` _(object)_:
    - `limit` _(number, def: 0)_: Максимум строк.
    - `offset` _(number, def: 0)_: Смещение (+ сверху, - снизу).
    - `reverse` _(boolean, def: false)_: Итерация снизу вверх.
    - `batchSize` _(number, def: 100)_: Размер пакета.

**Возвращает:** Значение из `stop()` или `undefined`.

### `insertRow(row)` / `insertRows(rows)`
Вставка данных.
- `row`: `{Col: Val}` или `[Val1, Val2]`.
- **Возвращает:** `TableContext` (chainable).

### `getColumns()`
Возвращает массив заголовков таблицы.
- **Возвращает:** `string[]`.

### `setColumns(columns)`
Задает новые заголовки.
- `columns` _(string[])_.

### `setName(name)`
Переименовывает таблицу.
- `name` _(string)_.

### `count` (Getter)
Количество строк с данными.
- **Возвращает:** `number`.

### `getMetadata()`
Возвращает Proxy-объект для работы с **Developer Metadata** уровня листа.
- **Возвращает:** `Object`.
    - `.save()`: Сохранить изменения в хранилище.
    - `.toJSON()`: Получить данные объекта.

---

<a name="data_methods"></a>
## Работа с RowContext [Объекты Данных]
[меню](#toc) | [далее](#examples) | [назад](#sub_methods)

Объект `row` внутри `each`.

### Чтение и запись
Доступ по имени колонки.
```javascript
let val = row.Title;  // Чтение
row.Title = 'New';    // Запись (кэшируется)
```

### `remove()`
Помечает строку на удаление (удаляется после цикла).

### `toJSON()`
Преобразует строку в JS-объект `{Header: Value}`.

### `getIndex()`
Возвращает номер строки (1-based).

### `getData()`
Возвращает сырой массив значений строки (`[val1, val2, ...]`). Полезно для доступа без привязки к именам колонок.

### `isDeleted()`
Возвращает `true`, если к строке был применен метод `remove()`.

---

<a name="examples"></a>
## 💡 Примеры использования
[меню](#toc) | [далее](#notes) | [назад](#data_methods)

### 1. Базовый CRUD (Create, Read, Update, Delete)
Стандартный сценарий работы с таблицей пользователей.

```javascript
function manageUsers() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActiveSpreadsheet());
  
  // Получаем или создаем таблицу
  const users = db.getTable('Users') || db.createTable('Users', ['ID', 'Name', 'Status']);

  // 1. CREATE: Массовая вставка
  users.insertRows([
    { ID: 101, Name: 'Alice', Status: 'Active' },
    { ID: 102, Name: 'Bob', Status: 'Pending' },
    { ID: 103, Name: 'Charlie', Status: 'Banned' }
  ]);

  // 2. READ & UPDATE & DELETE: Один проход
  users.each(row => {
    // Обновление
    if (row.Status === 'Pending') {
      row.Status = 'Active';
    }
    // Удаление
    if (row.Status === 'Banned') {
      row.remove();
    }
  });
}
```

### 2. Поиск одной записи (Find One)
Используйте `stop()`, чтобы прервать перебор сразу после нахождения нужной строки. Это значительно экономит время.

```javascript
function findUserByEmail(email) {
  const db = SpreadsheetDB.init('ID_ТАБЛИЦЫ');
  
  // Передаем 3-й аргумент 'stop'
  const user = db.getTable('Users').each((row, i, stop) => {
    if (row.Email === email) {
      // Прерываем цикл и возвращаем объект данных
      stop(row.toJSON());
    }
  }, { limit: 0 }); // Ищем по всей таблице

  if (user) {
    Logger.log(`Нашел: ${user.Name}`);
  } else {
    Logger.log('Пользователь не найден');
  }
}
```

### 3. Слайсинг и "Умная навигация"
Получение срезов данных без загрузки всей таблицы.

```javascript
const logs = db.getTable('SystemLogs');

// А) Получить последние 10 записей (Log tail)
// offset: -10 означает "начать за 10 строк до конца"
const recentLogs = [];
logs.each(row => {
  recentLogs.push(row.toJSON());
}, { offset: -10 });

// Б) Получить "Топ-5" лучших результатов (предполагая, что таблица отсортирована по возрастанию)
// reverse: true — идем с конца (где макс. значения)
// limit: 5 — берем только 5 штук
const topScores = [];
db.getTable('Scores').each(row => {
  topScores.push(row.toJSON());
}, { reverse: true, limit: 5 });
```

### 4. Пагинация (Pagination)
Реализация постраничного вывода данных для веб-интерфейса или API.

```javascript
function getProductsPage(pageNumber, pageSize) {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const products = [];
  
  // pageNumber начинается с 1
  const offset = (pageNumber - 1) * pageSize;

  db.getTable('Products').each(row => {
    products.push(row.toJSON());
  }, {
    offset: offset,  // Пропускаем (page-1) страниц
    limit: pageSize  // Берем ровно размер страницы
  });

  return products;
}
```

### 5. Транзакции с откатом и блокировкой
Гарантирует, что данные не повредятся при ошибке в середине процесса и что два пользователя не смогут изменить одни и те же данные одновременно. Например, перевод денег между счетами.


```javascript
function transferCredits(fromUser, toUser, amount) {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());

  try {
    // Пытаемся выполнить транзакцию (ждем блокировку макс. 5 сек)
    db.transaction((tx) => {
      const wallets = tx.getTable('Wallets');
      let withdrawn = false;
      let deposited = false;

      wallets.each((row, i, stop) => {
        // Списание
        if (row.User === fromUser) {
          if (row.Balance < amount) throw new Error('Недостаточно средств');
          row.Balance -= amount;
          withdrawn = true;
        }
        // Зачисление
        if (row.User === toUser) {
          row.Balance += amount;
          deposited = true;
        }
        // Если оба найдены — можно выходить (оптимизация)
        if (withdrawn && deposited) stop();
      });

      if (!withdrawn || !deposited) {
        throw new Error('Один из пользователей не найден');
      }
    }, { lockTimeout: 5000 });
    Logger.log('Перевод успешен');

  } catch (e) {
    Logger.log('Ошибка транзакции: ' + e.message); 
    // В этот момент таблица Wallets вернулась в исходное состояние
  }
}
```

### 6. Использование плагинов
Пример регистрации глобального метода для поиска дубликатов.

```javascript
// 1. Регистрируем метод (обычно в файле конфигурации)
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

// 2. Используем в бизнес-логике
function cleanUp() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const count = db.getTable('Emails').removeDuplicates('Address');
  Logger.log(`Удалено дублей: ${count}`);
}
```

### 7. Архивация данных (Перенос в другую таблицу)
Классическая задача: переместить выполненные заказы в архив, чтобы не засорять основную таблицу.

```javascript
function archiveCompletedOrders() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  
  // Используем транзакцию, чтобы не потерять данные при сбое
  db.transaction((tx) => {
    const activeOrders = tx.getTable('Orders');
    // Создаем архив с теми же колонками, если его нет
    const archive = tx.getTable('Orders_Archive') || 
                    tx.createTable('Orders_Archive', activeOrders.getColumns());

    activeOrders.each((row) => {
      if (row.Status === 'Done') {
        // 1. Копируем данные в архив
        archive.insertRow(row.toJSON());
        // 2. Помечаем на удаление из источника
        row.remove();
      }
    });
  });
}
```

### 8. Аналог VLOOKUP (Объединение таблиц)
Как эффективно обогатить одну таблицу данными из другой (например, подставить цену товара в заказ по ID).
**Важно:** Не делайте вложенные циклы `each` внутри `each` — это медленно. Используйте Map/Object для кэширования справочника.

```javascript
function enrichOrders() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const productsTable = db.getTable('Products');
  const ordersTable = db.getTable('Orders');

  // 1. Создаем справочник цен: { 'Prod_ID_1': 100, 'Prod_ID_2': 500 }
  const priceMap = {};
  productsTable.each(row => {
    priceMap[row.ID] = row.Price;
  });

  // 2. Проходим по заказам и подставляем цену
  ordersTable.each(row => {
    // Если цена еще не заполнена
    if (!row.Price && priceMap[row.ProductID]) {
      row.Price = priceMap[row.ProductID];
      row.Total = row.Price * row.Quantity; // Сразу считаем сумму
    }
  });
}
```

### 9. Очистка логов по дате (Date Filtering)
Удаление записей, которые старше 30 дней. Демонстрирует работу с объектами `Date`.

```javascript
function cleanupOldLogs() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // -30 дней от сегодня

  db.getTable('Logs').each(row => {
    // row.Timestamp возвращает объект Date (если в ячейке дата)
    // или строку (если текст). Лучше подстраховаться:
    const logDate = new Date(row.Timestamp);
    
    if (logDate < cutoffDate) {
      row.remove();
    }
  });
}
```

### 10. Массовый импорт из внешнего API
Пример того, как загрузить данные из JSON максимально быстро, используя `insertRows` (пакетная вставка).

```javascript
function syncFromCRM() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  const crmData = UrlFetchApp.fetch('https://api.example.com/leads').getContentText();
  const leadsArray = JSON.parse(crmData); // [{name: '..', email: '..'}, ...]

  const table = db.getTable('Leads');

  // Вариант А: Полная перезапись (удалить старое, вставить новое)
  /* 
  table.each(r => r.remove()); // Очистка
  table.insertRows(leadsArray); 
  */

  // Вариант Б: Добавление только новых (проверка дублей)
  // Сначала соберем существующие Email'ы для быстрой проверки
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
    table.insertRows(newRows); // Вставляем пачкой!
    Logger.log(`Добавлено ${newRows.length} новых лидов.`);
  }
}
```

### 11. Агрегация данных (Отчет)
Подсчет сумм и группировка без формул (аналог Pivot Table в коде).

```javascript
function generateReport() {
  const db = SpreadsheetDB.init(SpreadsheetApp.getActive());
  
  // Объект для хранения итогов: { 'ManagerA': 1500, 'ManagerB': 2000 }
  const salesByManager = {};

  db.getTable('Sales').each(row => {
    const manager = row.Manager;
    const amount = Number(row.Amount) || 0;

    if (!salesByManager[manager]) {
      salesByManager[manager] = 0;
    }
    salesByManager[manager] += amount;
  });

  // Вывод результата (например, в другую таблицу)
  const reportData = Object.keys(salesByManager).map(mgr => ({
    Manager: mgr,
    TotalSales: salesByManager[mgr]
  }));
  
  const reportTable = db.getTable('Report') || db.createTable('Report', ['Manager', 'TotalSales']);
  
  // Очищаем старый отчет и пишем новый
  // (Используем плагин clearAll, если он добавлен, или просто удаляем строки)
  reportTable.each(r => r.remove()); 
  reportTable.insertRows(reportData);
}
```

---

<a name="notes"></a>
## ⚠️ Важные замечания
[меню](#toc) | [далее](#tips) | [назад](#examples)

1.  **Синхронизация заголовков**: Библиотека инициализирует карту колонок при создании `TableContext`. Если вы измените заголовки в Google Sheets вручную во время работы скрипта, нужно пересоздать инстанс таблицы.
2.  **Валидация**: Обращение к `row.MissingColumn` вызовет ошибку `Column not found`. Это защита от опечаток.
3.  **Метаданные**: `getMetadata()` использует Google Developer Metadata. Эти данные не видны на листе, они "вшиты" в файл/лист.

---

<a name="tips"></a>
## 🎯 Советы по использованию
[меню](#toc) | [далее](#limits) | [назад](#notes)

### Производительность
Используйте `insertRows` (массив) вместо `insertRow` (одиночная) в цикле.

```javascript
// ✅ Быстро
const newRows = data.map(item => ({ Name: item.name }));
table.insertRows(newRows);
```

### Расширяемость
Используйте статические методы `SpreadsheetDB.addTableMethod` для создания переиспользуемых функций.

---

<a name="limits"></a>
## 🐛 Известные ограничения
[меню](#toc) | [назад](#tips)

1.  **Формулы**: При чтении через `row.Col` вы получаете вычисленное значение. Чтобы записать формулу, присвойте строку, начинающуюся с `=` (`row.Total = '=SUM(A1:B1)'`).
2.  **Квоты**: Библиотека оптимизирует запросы, но лимиты Google (время выполнения, кол-во операций чтения/записи в день) остаются в силе.