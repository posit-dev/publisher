import * as vscode from 'vscode';

const viewName = 'posit.publisher.logs';

export class LogsTreeDataProvider implements vscode.TreeDataProvider<LogsTreeItem> {

  getTreeItem(element: LogsTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(_: LogsTreeItem | undefined): vscode.ProviderResult<LogsTreeItem[]> {
    return [
      new LogsTreeItem('Log Item', vscode.TreeItemCollapsibleState.Collapsed),
    ];
  }

  public register(context: vscode.ExtensionContext) {
    vscode.window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, {
        treeDataProvider: this
      })
    );
  }
}

export class LogsTreeItem extends vscode.TreeItem {

  constructor(label: string, state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, state);
    this.tooltip = `${this.label}`;
  }
}
