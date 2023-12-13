import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	test('activate', async () => {
		const extension: vscode.Extension<any> = vscode.extensions.getExtension("undefined_publisher.publisher")!;
		await extension.activate();
		if (!extension.isActive) {
			assert.fail();
		}
	});
});
