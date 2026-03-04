import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/mocks/vscode.ts"),
      positron: path.resolve(__dirname, "src/mocks/positron.ts"),
      src: path.resolve(__dirname, "../../extensions/vscode/src"),
    },
  },
  test: {
    include: ["src/contracts/**/*.test.ts"],
  },
});
