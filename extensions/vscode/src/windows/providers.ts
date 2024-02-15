import * as vscode from 'vscode';

import { HOST } from '..';
import { Service } from '../services';

export class SimpleTreeItem extends vscode.TreeItem {

    constructor(port: number) {
        super(`${HOST}:${port}`);
    }
}

export class SimpleTreeDataProvider implements vscode.TreeDataProvider<SimpleTreeItem> {

    port: number;

    constructor(port: number) {
        this.port = port;
    }

    onDidChangeTreeData?: vscode.Event<void | SimpleTreeItem | SimpleTreeItem[] | null | undefined> | undefined;

    getTreeItem(element: SimpleTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(_?: SimpleTreeItem | undefined): vscode.ProviderResult<SimpleTreeItem[]> {
        return [
            new SimpleTreeItem(this.port)
        ];
    }
    getParent?(element: SimpleTreeItem): vscode.ProviderResult<SimpleTreeItem> {
        return element;
    }
    resolveTreeItem?(_1: vscode.TreeItem, _2: SimpleTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        throw new Error('Method not implemented.');
    }
}
