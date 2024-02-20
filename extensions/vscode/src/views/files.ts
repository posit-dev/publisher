import * as vscode from 'vscode';

const viewName = 'posit.publisher.files.provider';

export class FilesTreeDataProvider implements vscode.TreeDataProvider<FilesTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<FilesTreeItem | undefined | void> = new vscode.EventEmitter<FilesTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FilesTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

  getTreeItem(element: FilesTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: FilesTreeItem | undefined): vscode.ProviderResult<FilesTreeItem[]> {
    if (element === undefined) {
      return [
        new FilesTreeItem('Dummy File'),
      ];
    }
    return [];
  }

  getParent?(element: FilesTreeItem): vscode.ProviderResult<FilesTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: FilesTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<FilesTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
    vscode.window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class FilesTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.files.tree.item';
  tooltip = 'This is a \nFiles Tree Item';
}
