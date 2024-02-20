import * as vscode from 'vscode';

const viewName = 'posit.publisher.credentials.provider';

export class CredentialsTreeDataProvider implements vscode.TreeDataProvider<CredentialsTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<CredentialsTreeItem | undefined | void> = new vscode.EventEmitter<CredentialsTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<CredentialsTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

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

  getParent?(element: CredentialsTreeItem): vscode.ProviderResult<CredentialsTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: CredentialsTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<CredentialsTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
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
