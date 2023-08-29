import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

// https://vitejs.dev/config/
// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
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
  server: {
    open: false,
    proxy: {
      // proxy all requests starting with /apii to CLI
      '/api': {
        target: 'http://127.0.0.1:9001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
