import * as vscode from 'vscode';

const viewName = 'posit.publisher.deployments.provider';

export class DeploymentsTreeDataProvider implements vscode.TreeDataProvider<DeploymentsTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<DeploymentsTreeItem | undefined | void> = new vscode.EventEmitter<DeploymentsTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<DeploymentsTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

  getTreeItem(element: DeploymentsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }
  getChildren(element: DeploymentsTreeItem | undefined): vscode.ProviderResult<DeploymentsTreeItem[]> {
    if (element === undefined) {
      return [
        new DeploymentsTreeItem('Dummy Deployments'),
      ];
    }
    return [];
  }
  getParent?(element: DeploymentsTreeItem): vscode.ProviderResult<DeploymentsTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: DeploymentsTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<DeploymentsTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
    vscode.window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class DeploymentsTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.deployments.tree.item';
  tooltip = 'This is a \nDeployments Tree Item';
}
