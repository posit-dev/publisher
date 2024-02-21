import * as vscode from 'vscode';

const viewName = 'posit.publisher.dependencies.provider';

export class DependenciesTreeDataProvider implements vscode.TreeDataProvider<DependenciesTreeItem> {

  constructor() { }

  getTreeItem(element: DependenciesTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: DependenciesTreeItem | undefined): vscode.ProviderResult<DependenciesTreeItem[]> {
    if (element === undefined) {
      return [
        new DependenciesTreeItem('Dummy Dependencies'),
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

export class DependenciesTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.dependencies.tree.item';
  tooltip = 'This is a \nDependencies Tree Item';
}
