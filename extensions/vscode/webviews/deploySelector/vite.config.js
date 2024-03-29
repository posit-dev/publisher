"use strict";
// import { fileURLToPath, URL } from 'url'
Object.defineProperty(exports, "__esModule", { value: true });
const vite = require("vite");
const pluginVue = require("@vitejs/plugin-vue");
// https://vitejs.dev/config/
exports.default = (0, vite.defineConfig)({
  plugins: [
    (0, pluginVue.default)({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.includes("vscode-") },
      },
    }),
  ],
  // resolve: {
  //   alias: {
  //     '@': fileURLToPath(new URL('./src', import.meta.url))
  //   }
  // },
  build: {
    outDir: "../../out/webviews/deploySelector",
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
    sourcemap: "inline",
  },
});
//# sourceMappingURL=vite.config.js.map
