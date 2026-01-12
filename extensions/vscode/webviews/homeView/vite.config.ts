/// <reference types="vitest/config" />

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
      include: ["src/**/*.{js,jsx,ts,tsx,vue}"],
      exclude: ["*.d.ts"],
      enabled: true,
      thresholds: {
        functions: 16,
        lines: 17,
        branches: 11,
        statements: 17,
        // avoid auto-updating thresholds to avoid off by 0.01 differences
        autoUpdate: false,
      },
    },
  },
});
