import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  root: path.resolve(process.cwd(), 'src/frontend'),
  plugins: [
    svelte(),
    // Передаем настройки плагину явно
    viteSingleFile({ 
      removeViteModuleLoader: true 
    })
  ],
  build: {
    outDir: path.resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
    minify: true,
    modulePreload: false, // Отключаем прелоад модулей, GAS это не умеет
  }
});
