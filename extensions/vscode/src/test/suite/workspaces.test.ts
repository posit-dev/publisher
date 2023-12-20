import * as assert from 'assert';

import * as vscode from 'vscode';
import * as workspaces from '../../workspaces';

suite('Workspaces Test Suite', () => {
	test('path when platform is win32', async () => {
        const path = workspaces.path('win32');
        assert(path);
        assert.ok(path.includes("\\"));
        assert.ok(path[0] !== '\\');
	});
    test('path when platform is linux', async () => {
		const path = workspaces.path('linux');
        assert(path);
        assert.ok(path.includes("/"));
	});
});
