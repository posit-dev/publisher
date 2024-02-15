import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { defineConfig } from 'vite'

import type { InlineConfig } from 'vitest'
import type { UserConfig } from 'vite'

interface VitestConfigExport extends UserConfig {
  test: InlineConfig;
}

module.exports = defineConfig(({ mode }) => {
  let indexPath = './src/view/index.ts'
  if (mode === 'webViewView1') {
    indexPath =  './src/view/index_webViewView1.ts';
  } else if (mode === 'webViewView2') {
    indexPath =  './src/view/index_webViewView2.ts';
  }
  return {
    plugins: [
      vue({ customElement: true }),
      Icons({
        autoInstall: true,
      }),
      VueI18nPlugin({ }),
    ],
    build: {
      lib: {
        entry: `${indexPath}`,
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format}.js`
      },
      emptyOutDir: false,
      outDir: `dist/compiled/${mode}`,
    },
    test: {
      globals: true,
      include: ['**/*.spec.ts'],
      setupFiles: [
        './setupTests.ts',
      ],
      environment: 'jsdom',
    },
  } as VitestConfigExport;
});
