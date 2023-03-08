import eslint from 'vite-plugin-eslint'
import jsconfigpaths from 'vite-jsconfig-paths'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    eslint(),
    jsconfigpaths(),
    vue(),
    vuetify()
  ]
})