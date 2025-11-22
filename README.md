# Google Apps Script + Svelte 5 Template (No-TS)

A professional, modern template for developing Google Apps Script (GAS) projects using **Svelte 5** and pure **JavaScript**.

This project uses a unique **"Injection Strategy"** build system: you write modular code with `import`, and the builder automatically bundles dependencies directly into your GAS files, preserving the global scope for triggers like `doGet` and `onOpen`.

## 🌟 Features

*   **Svelte 5 (Runes):** Full support for `$state`, `$effect`, and the latest Svelte reactivity features.
*   **Smart Injection Build:** Use `import { format } from 'date-fns'` directly in GAS files. The library is automatically downloaded, bundled into an isolated closure, and injected inline.
*   **Zero GlobalThis Hacks:** Write standard functions like `function doGet()`. The builder ensures Google Apps Script can see them.
*   **Vite:** Lightning-fast frontend build process (bundles everything into a single HTML file).
*   **Unicode Friendly:** The builder is configured to handle non-Latin characters (like Cyrillic) correctly during minification.

## 📂 Project Structure

```text
root/
├── .clasp.json           # Clasp settings (links to Google Cloud Project)
├── package.json          # Dependencies and scripts
├── build.js              # (!) The main build script (Backend + Frontend)
├── vite.config.js        # Vite settings
│
├── src/
│   ├── appsscript.json   # GAS Manifest (permissions, timezone)
│   │
│   ├── backend/          # Server-side code (GAS)
│   │   ├── main.js       # Entry point
│   │   ├── utils.js
│   │   └── ...
│   │
│   └── frontend/         # Client-side code (Svelte)
│       ├── index.html
│       ├── main.js
│       └── App.svelte
│
└── dist/                 # Build output (automatically cleaned)
```

## 🚀 Installation & Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Setup Clasp:**
    Install Clasp globally and log in:
    ```bash
    npm install -g @google/clasp
    clasp login
    ```

3.  **Link to Google Project:**
    Create a `.clasp.json` file in the root directory:
    ```json
    {
      "scriptId": "YOUR_SCRIPT_ID",
      "rootDir": "./dist"
    }
    ```

## 🛠 Commands (Scripts)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Vite server. Frontend only (Hot Module Replacement). Backend calls are mocked. |
| `npm run build` | Full production build to the `dist/` folder. |
| `npm run push` | Builds and pushes code to Google Drive (Development mode). |
| `npm run deploy` | **Full Release Cycle:** Build → Push → Create a new Versioned Deployment. |


## 🧩 How to Write Code (Backend)

The builder uses an "Inlining" strategy. This allows you to use the power of NPM libraries while remaining compatible with the GAS environment.

### 1. Imports (Libraries)
You can import functions from NPM packages or local files.

```javascript
// src/backend/main.js
import { format } from 'date-fns'; // NPM library
import { helper } from './utils.js'; // Local file

function doGet() {
  // The date-fns library will be built and injected directly into this variable
  const date = format(new Date(), 'yyyy-MM-dd'); 
  return HtmlService.createHtmlOutput(date);
}
```

**How it works:**
The builder finds the `import`, bundles the specified library using `esbuild` into an isolated IIFE (Immediately Invoked Function Expression), and replaces the import line with:
```javascript
const { format } = (() => { /* ...date-fns code... */ return exports; })();
```

### 2. Variable Scope
Since all backend files are concatenated into a single `Code.js` by default (`concatenate: true` setting), top-level variables are shared across files.

*   **Tip:** Avoid using generic variable names like `const data = ...` in the global scope across different files.
*   Use block scopes `{ ... }` or functions for internal logic.

## ⚙️ Build Configuration (build.js)

You can tweak the build process in the `CONFIG` object within `build.js`:

```javascript
backendSettings: {
  concatenate: true,   // true = Merge all files into one Code.js (Recommended)
                       // false = Keep files separate (Imports are still inlined)
  
  outFile: 'Code.js',  // Final output filename
  
  minify: true,        // Minify code to save space.
                       // Note: Function names like doGet are preserved if needed.
                       
  priorityOrder: [     // Order of concatenation (important for global vars)
    'config.js',
    'utils/logger.js'
  ]
},

modules: {
  frontend: true,      // Set to false if you are only editing backend
  backend: true
}
```

## 📝 License
MIT