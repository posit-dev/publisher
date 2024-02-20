import * as vscode from 'vscode';

const viewName = 'posit.publisher.configurations.provider';

export class ConfigurationsTreeDataProvider implements vscode.TreeDataProvider<ConfigurationTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<ConfigurationTreeItem | undefined | void> = new vscode.EventEmitter<ConfigurationTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ConfigurationTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

  getTreeItem(element: ConfigurationTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: ConfigurationTreeItem | undefined): vscode.ProviderResult<ConfigurationTreeItem[]> {
    if (element === undefined) {
      return [
        new ConfigurationTreeItem('Dummy Configurations'),
      ];
    }
    return [];
  }

  getParent?(element: ConfigurationTreeItem): vscode.ProviderResult<ConfigurationTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: ConfigurationTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<ConfigurationTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
    vscode.window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      vscode.window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class ConfigurationTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.configurations.tree.item';
  tooltip = 'This is a \nConfigurations Tree Item';
}
