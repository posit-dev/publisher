"use strict";
// import { fileURLToPath, URL } from 'url'
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const plugin_vue_1 = require("@vitejs/plugin-vue");
// https://vitejs.dev/config/
exports.default = (0, vite_1.defineConfig)({
    plugins: [
        (0, plugin_vue_1.default)({
            template: { compilerOptions: { isCustomElement: (tag) => tag.includes("vscode-") } },
        }),
    ],
    // resolve: {
    //   alias: {
    //     '@': fileURLToPath(new URL('./src', import.meta.url))
    //   }
    // },
    build: {
        outDir: "../../out/webviews/projectSelector",
        rollupOptions: {
            output: {
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`,
            },
        },
        sourcemap: 'inline',
    },
});
//# sourceMappingURL=vite.config.js.map