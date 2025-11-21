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
  },
});
