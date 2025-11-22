import fs from 'fs';
import path from 'path';
import { build as esbuild } from 'esbuild';
import { minify } from 'terser';
import { execSync } from 'child_process';

// ==========================================
// 1. КОНФИГУРАЦИЯ
// ==========================================
const CONFIG = {
  srcManifest: 'src/appsscript.json',
  srcBackend: 'src/backend',
  outDir: 'dist',
  packageJsonPath: './package.json',

  modules: {
    frontend: true,
    backend: true
  },

  backendSettings: {
    concatenate: true,
    outFile: 'Code.js',
    minify: true,
    priorityOrder: [
      'config.js',
      'utils/logger.js'
    ]
  }
};

// ==========================================
// 2. УТИЛИТЫ
// ==========================================
const logger = {
  info: (msg) => console.log(`🔹 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

function cleanDist() {
  if (fs.existsSync(CONFIG.outDir)) fs.rmSync(CONFIG.outDir, { recursive: true, force: true });
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
}

function getBanner() {
  try {
    if (!fs.existsSync(CONFIG.packageJsonPath)) return '';
    
    const pkg = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, 'utf-8'));
    
    let banner = '/**\n';
    
    // Название и версия
    banner += ` * ${pkg.name || 'App'} v${pkg.version || '0.0.0'}\n`;
    
    // Описание
    if (pkg.description) {
      banner += ` * ${pkg.description}\n`;
    }
    
    // Автор
    if (pkg.author) {
      if (typeof pkg.author === 'string') {
        banner += ` * @author ${pkg.author}\n`;
      } else if (typeof pkg.author === 'object') {
        let authorStr = pkg.author.name || '';
        if (pkg.author.email) authorStr += ` <${pkg.author.email}>`;
        if (pkg.author.url) authorStr += ` (${pkg.author.url})`;
        if (authorStr) banner += ` * @author ${authorStr}\n`;
      }
    }
    
    // Репозиторий
    if (pkg.repository) {
      let repoUrl = '';
      if (typeof pkg.repository === 'string') {
        repoUrl = pkg.repository;
      } else if (typeof pkg.repository === 'object' && pkg.repository.url) {
        repoUrl = pkg.repository.url;
      }
      
      // Чистим git+ префикс и .git суффикс
      repoUrl = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');
      
      if (repoUrl) {
        banner += ` * @repository ${repoUrl}\n`;
      }
    }
    
    // Лицензия
    if (pkg.license) {
      banner += ` * @license ${pkg.license}\n`;
    }
    
    banner += ` */\n`;
    
    return banner;
  } catch (error) {
    logger.warn('Не удалось прочитать package.json для баннера');
    return '';
  }
}

function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

function sortFiles(files, srcDir, priorityList) {
  const normalizedPriority = priorityList.map(p => path.normalize(p));
  return [...files].sort((a, b) => {
    const relA = path.relative(srcDir, a);
    const relB = path.relative(srcDir, b);
    const indexA = normalizedPriority.indexOf(relA);
    const indexB = normalizedPriority.indexOf(relB);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return relA.localeCompare(relB);
  });
}

// ==========================================
// 3. ЛОГИКА ИМПОРТОВ
// ==========================================

async function bundleImport(importPath, exportNames, isDefault, workingDir) {
  let entryContent = '';
  if (isDefault) {
    entryContent = `export { default as default } from '${importPath}';`;
  } else {
    entryContent = `export { ${exportNames} } from '${importPath}';`;
  }

  try {
    const result = await esbuild({
      stdin: {
        contents: entryContent,
        resolveDir: path.resolve(workingDir),
        loader: 'js',
        sourcefile: 'virtual-entry.js'
      },
      bundle: true,
      minify: true,
      keepNames: false,
      treeShaking: true,
      legalComments: 'none',
      format: 'esm',
      target: 'es2020',
      write: false,
    });

    let code = result.outputFiles[0].text.trim();

    while (code.endsWith(';') || code.endsWith('\n')) {
      code = code.slice(0, -1);
    }

    const lastExportIndex = code.lastIndexOf('export');
    if (lastExportIndex === -1) return `(() => { ${code}; return {}; })()`;

    const body = code.slice(0, lastExportIndex);
    let exportStatement = code.slice(lastExportIndex);

    let returnObj = '';
    if (exportStatement.includes('default') && !exportStatement.includes('{')) {
      const val = exportStatement.replace(/export\s+default\s+/, '').trim();
      returnObj = `{ default: ${val} }`;
    } else {
      const content = exportStatement.replace(/^export\s*\{/, '').replace(/\}\s*$/, '').trim();
      const parts = content.split(',');
      const props = [];
      parts.forEach(part => {
        part = part.trim();
        if (!part) return;
        if (part.includes(' as ')) {
          const [localName, exportName] = part.split(' as ');
          props.push(`${exportName.trim()}: ${localName.trim()}`);
        } else {
          props.push(`${part}: ${part}`);
        }
      });
      returnObj = `{ ${props.join(', ')} }`;
    }

    const separator = (body.trim().endsWith(';') || !body.trim()) ? '' : ';';
    return `(() => { ${body}${separator} return ${returnObj}; })()`;

  } catch (e) {
    logger.error(`Ошибка при сборке импорта: ${importPath}`);
    throw e;
  }
}

async function processFileImports(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);
  const importRegex = /import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"];?/g;

  const matches = [...code.matchAll(importRegex)];
  for (const match of matches.reverse()) {
    const fullStatement = match[0];
    const defaultImport = match[1];
    const namedImports = match[2];
    const importPath = match[3];
    const index = match.index;

    logger.info(`  -> Inlining: ${importPath}`);

    let replacement = '';
    let bundledCode = '';

    if (defaultImport) {
      bundledCode = await bundleImport(importPath, null, true, fileDir);
      replacement = `const ${defaultImport} = (function(r){ return r.default || r; })(${bundledCode});`;
    } else if (namedImports) {
      bundledCode = await bundleImport(importPath, namedImports, false, fileDir);
      replacement = `const { ${namedImports} } = ${bundledCode};`;
    }

    code = code.substring(0, index) + replacement + code.substring(index + fullStatement.length);
  }
  return code;
}

// ==========================================
// 4. ИЗВЛЕЧЕНИЕ ГЛОБАЛЬНЫХ ИМЕН
// ==========================================

function extractGlobalNames(code) {
  const functionNames = [...code.matchAll(/^function\s+([a-zA-Z0-9_$]+)/gm)].map(m => m[1]);
  const varNames = [...code.matchAll(/^var\s+([a-zA-Z0-9_$]+)/gm)].map(m => m[1]);
  return [...new Set([...functionNames, ...varNames])];
}

// ==========================================
// 5. СБОРКА
// ==========================================

function buildFrontend() {
  logger.info('Сборка Frontend...');
  try {
    execSync('npx vite build', { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
}

async function buildBackend() {
  logger.info('Сборка Backend...');
  const { srcBackend, outDir, backendSettings, srcManifest } = CONFIG;

  const allFiles = getAllJsFiles(srcBackend);
  if (!allFiles.length) return;

  const sortedFiles = sortFiles(allFiles, srcBackend, backendSettings.priorityOrder);
  
  const processedFiles = [];
  for (const file of sortedFiles) {
    try {
      const processedCode = await processFileImports(file);
      const cleanCode = processedCode.replace(/^export\s+(function|const|let|var|class)/gm, '$1');
      
      processedFiles.push({
        path: file,
        relPath: path.relative(srcBackend, file),
        code: cleanCode
      });
    } catch (e) {
      logger.error(`Ошибка в файле ${file}`);
      console.error(e);
      process.exit(1);
    }
  }

  if (backendSettings.concatenate) {
    logger.info('Склейка файлов...');
    let finalContent = '';
    
    for (const pFile of processedFiles) {
      finalContent += `\n// --- ${pFile.relPath} ---\n${pFile.code}\n`;
    }

    const globalNames = extractGlobalNames(finalContent);
    
    if (globalNames.length > 0) {
      logger.info(`Защищенные имена: ${globalNames.join(', ')}`);
    }

    if (backendSettings.minify) {
       logger.info('Полная минификация (Terser)...');
       
       // Проверяем, что код валидный перед отправкой в Terser
       try {
         new Function(finalContent);
       } catch (parseError) {
         logger.error('Код содержит синтаксические ошибки ДО минификации:');
         console.error(parseError);
         
         fs.writeFileSync(path.join(outDir, 'debug_pre_minify.js'), finalContent);
         logger.warn('Сохранен debug_pre_minify.js для анализа');
         
         process.exit(1);
       }
       
       try {
         const result = await minify(finalContent, {
           ecma: 2020,
           
           parse: {
             html5_comments: false,
           },
           
           mangle: {
             reserved: globalNames,
             toplevel: true
           },
           
           compress: {
             dead_code: true,
             drop_console: false,
             passes: 2,
           },
           
           format: {
             comments: false,
             ascii_only: false, // Сохраняем кириллицу
             ecma: 2020,
           },
         });

         if (result.code) {
           finalContent = result.code;
         } else {
           logger.warn('Terser вернул пустой результат, используем исходный код');
         }
       } catch (e) {
         logger.error('Ошибка минификации Terser:');
         console.error(e);
         
         if (e.line !== undefined) {
           const lines = finalContent.split('\n');
           const start = Math.max(0, e.line - 3);
           const end = Math.min(lines.length, e.line + 2);
           
           logger.error('\nКонтекст ошибки:');
           for (let i = start; i < end; i++) {
             const marker = i === e.line - 1 ? '>>> ' : '    ';
             logger.error(`${marker}${i + 1}: ${lines[i]}`);
           }
         }
         
         fs.writeFileSync(path.join(outDir, 'debug_terser_error.js'), finalContent);
         logger.warn('Сохранен debug_terser_error.js');
         
         process.exit(1);
       }
    }
    
    const banner = getBanner();
    fs.writeFileSync(path.join(outDir, backendSettings.outFile), banner + finalContent);
    logger.success(`Собрано в ${backendSettings.outFile}`);

  } else {
    // Режим без конкатенации
    for (const pFile of processedFiles) {
      let content = pFile.code;
      
      const globalNames = extractGlobalNames(content);
      
      if (backendSettings.minify) {
         try {
           const result = await minify(content, {
             ecma: 2020,
             parse: { html5_comments: false },
             mangle: { reserved: globalNames, toplevel: true },
             compress: { dead_code: true, passes: 2, drop_console: false },
             format: { comments: false, ascii_only: false, ecma: 2020 },
           });
           
           if (result.code) content = result.code;
         } catch (e) {
           logger.error(`Ошибка минификации ${pFile.relPath}:`);
           console.error(e);
         }
      }

      const destPath = path.join(outDir, pFile.relPath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      fs.writeFileSync(destPath, content);
      logger.info(`-> ${pFile.relPath}`);
    }
  }

  if (fs.existsSync(srcManifest)) {
    fs.copyFileSync(srcManifest, path.join(outDir, 'appsscript.json'));
    logger.success('Manifest copied.');
  } else {
    logger.warn(`Manifest not found: ${srcManifest}`);
  }
}

async function run() {
  const start = Date.now();
  cleanDist();

  if (CONFIG.modules.frontend) buildFrontend();
  if (CONFIG.modules.backend) await buildBackend();
  
  logger.success(`Готово за ${(Date.now() - start)}ms`);
}

run();
