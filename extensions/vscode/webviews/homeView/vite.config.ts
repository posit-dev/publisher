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
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  build: {
    rollupOptions: {
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
        functions: 27.77,
        lines: 16.06,
        branches: 37.97,
        statements: 16.06,
        autoUpdate: true,
      },
    },
  },
});
