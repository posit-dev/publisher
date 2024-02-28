// Copyright (C) 2024 by Posit Software, PBC.

import * as path from 'path';

import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

async function main() {
  try {
    const vscodeExecutablePath = await downloadAndUnzipVSCode(process.env.VSCODE_VERSION);

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const testWorkspace = path.resolve(__dirname, '../../../../test/sample-content/fastapi-simple/');

    // Download VS Code, unzip it and run the integration test
    await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace] });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
