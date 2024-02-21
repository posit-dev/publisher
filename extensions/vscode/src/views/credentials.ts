import * as vscode from 'vscode';

const viewName = 'posit.publisher.credentials';

export class CredentialsTreeDataProvider implements vscode.TreeDataProvider<CredentialsTreeItem> {

  constructor() { }

  getTreeItem(element: CredentialsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: CredentialsTreeItem | undefined): vscode.ProviderResult<CredentialsTreeItem[]> {
    if (element === undefined) {
      return [
        new CredentialsTreeItem('Dummy Credentials'),
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
export class CredentialsTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.credentials.tree.item';
  tooltip = 'This is a \nCredentials Tree Item';
}
