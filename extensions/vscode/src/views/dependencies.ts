import * as vscode from 'vscode';

const viewName = 'posit.publisher.dependencies.provider';

export class DependenciesTreeDataProvider implements vscode.TreeDataProvider<DependenciesTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<DependenciesTreeItem | undefined | void> = new vscode.EventEmitter<DependenciesTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<DependenciesTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

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

  getParent?(element: DependenciesTreeItem): vscode.ProviderResult<DependenciesTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: DependenciesTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<DependenciesTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
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
