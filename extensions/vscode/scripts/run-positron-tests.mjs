// Copyright (C) 2026 by Posit Software, PBC.

// Launcher for the Positron-only integration tests (src/test/positron/).
//
// Downloads (or reuses a cached) Positron build and runs the compiled Mocha
// entry point (out/test/positron/index.js) inside it, via
// @posit-dev/positron-test-electron.
//
// Run with `npm run test-positron` (which builds the extension and tests
// first). Set POSITRON_CHANNEL=daily to test against a daily Positron build
// (default: stable).
//
// NOTE: @posit-dev/positron-test-electron currently supports macOS only;
// Windows/Linux support is planned upstream.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@posit-dev/positron-test-electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Extension root (contains package.json); scripts/ lives one level below it.
  const extensionDevelopmentPath = path.resolve(__dirname, "..");

  // Compiled Mocha entry point that discovers and runs the Positron tests.
  const extensionTestsPath = path.resolve(
    extensionDevelopmentPath,
    "out",
    "test",
    "positron",
    "index.js",
  );

  // Publisher activates on workspaceContains:/ — open the same sample project
  // the plain VSCode suite uses (.vscode-test.mjs).
  const workspacePath = path.resolve(
    extensionDevelopmentPath,
    "..",
    "..",
    "test",
    "sample-content",
    "fastapi-simple",
  );

  const code = await runTests({
    channel: process.env.POSITRON_CHANNEL === "daily" ? "daily" : "stable",
    extensionDevelopmentPath,
    extensionTestsPath,
    // The interpreter-discovery tests need Positron's bundled runtime
    // extensions (Python, Ark/R) to register language runtimes, so opt out of
    // the default --disable-extensions.
    disableExtensions: false,
    launchArgs: [workspacePath, "--disable-workspace-trust"],
  });

  process.exit(code);
}

main().catch((err) => {
  console.error("Failed to run Positron integration tests:");
  console.error(err);
  process.exit(1);
});
