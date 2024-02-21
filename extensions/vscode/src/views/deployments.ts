import * as vscode from 'vscode';

const viewName = 'posit.publisher.deployments.provider';

export class DeploymentsTreeDataProvider implements vscode.TreeDataProvider<DeploymentsTreeItem> {

  constructor() { }

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

  public register(context: vscode.ExtensionContext) {
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
