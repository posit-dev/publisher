/// <reference types="vitest" />

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

// https://vitejs.dev/config/
// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        // The default value is "assets/[name]-[hash][extname]". The [hash] pattern is removed in order to force a deterministic filename name when loading index.css and index.js from additional locations, such as the VSCode extension.
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    quasar()
  ],
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    }
  },
  preview: {
    port: 9000,
  },
  server: {
    open: false,
    port: 9000,
    proxy: {
      // proxy all requests starting with /api to CLI
      '/api': {
        target: 'http://127.0.0.1:9001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    environment: 'jsdom',
  }
});
