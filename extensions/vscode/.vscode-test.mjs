import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  // Only the plain VSCode suite; out/test/positron/ holds the Positron-only
  // tests, which are run by `npm run test-positron` inside a Positron build.
  files: "out/test/suite/**/*.test.js",
  workspaceFolder: `${import.meta.dirname}/../../../../test/sample-content/fastapi-simple`,
});
