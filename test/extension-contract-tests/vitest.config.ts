// Copyright (C) 2026 by Posit Software, PBC.

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // No alias for @posit-dev/positron: it is a real npm package, and its
      // tryAcquirePositronApi() reads the acquirePositronApi global that
      // Positron injects. Tests inject that global from src/mocks/positron.ts,
      // so the package's real acquisition logic runs against the mock host.
      vscode: path.resolve(__dirname, "src/mocks/vscode.ts"),
      src: path.resolve(__dirname, "../../extensions/vscode/src"),
    },
  },
  test: {
    include: ["src/contracts/**/*.test.ts"],
    globalSetup: ["src/globalSetup.ts"],
  },
});
