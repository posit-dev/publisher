import * as vscode from 'vscode';

const viewName = 'posit.publisher.configurations';

export class ConfigurationsTreeDataProvider implements vscode.TreeDataProvider<ConfigurationTreeItem> {

  constructor() { }

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

  public register(context: vscode.ExtensionContext) {
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
