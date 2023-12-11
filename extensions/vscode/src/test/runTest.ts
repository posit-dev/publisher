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

		// Download VS Code, unzip it and run the integration test
		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
