import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/**/*.test.js",
  workspaceFolder: `${import.meta.dirname}/../../../../test/sample-content/fastapi-simple`,
});
