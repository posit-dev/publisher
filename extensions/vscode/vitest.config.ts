/// <reference types="vitest/config" />
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// Configuration to run unit tests under the ./src dir
// Excluding vscode extension tests suite
export default defineConfig({
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["./src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["./src/test/**"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["*.d.ts", "src/test/**"],
      enabled: true,
      reporter: ["text", "json-summary"],
      thresholds: {
        functions: 5,
        lines: 5,
        branches: 5,
        statements: 5,
        autoUpdate: false,
      },
    },
  },
});
