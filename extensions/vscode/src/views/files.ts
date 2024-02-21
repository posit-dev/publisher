import * as vscode from 'vscode';

const viewName = 'posit.publisher.files.provider';

export class FilesTreeDataProvider implements vscode.TreeDataProvider<FilesTreeItem> {

  constructor() { }

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

  public register(context: vscode.ExtensionContext) {
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
