import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	test('extension can activate', async () => {
		const extension: vscode.Extension<any> = vscode.extensions.getExtension("posit.publisher")!;
		assert.ok(!extension.isActive);
		await extension.activate();
		assert.ok(extension.isActive);
	});
});
