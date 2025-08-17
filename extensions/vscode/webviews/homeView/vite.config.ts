/// <reference types="vitest" />

import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.includes("vscode-") },
      },
    }),
  ],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      external: ["vscode"], // Exclude 'vscode' module
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
    sourcemap: "inline",
  },
  test: {
    environment: "jsdom",
    coverage: {
      enabled: true,
      thresholds: {
        functions: 30,
        lines: 17,
        branches: 44,
        statements: 17,
        // avoid auto-updating thresholds to avoid off by 0.01 differences
        autoUpdate: false,
      },
    },
  },
});
