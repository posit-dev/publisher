/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Configuration to run unit tests under the ./src dir
// Excluding vscode extension tests suite
export default defineConfig({
  test: {
    include: ["./src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["./src/test/**"],
  },
});
