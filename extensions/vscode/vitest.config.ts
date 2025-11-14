/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import path from "path";

// Configuration to run unit tests under the ./src dir
// Excluding vscode extension tests suite
export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["./src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["./src/test/**"],
  },
});
