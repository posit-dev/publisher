import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.configurations';

export class ConfigurationsTreeDataProvider implements TreeDataProvider<ConfigurationTreeItem> {

  constructor() { }

  getTreeItem(element: ConfigurationTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: ConfigurationTreeItem | undefined): ProviderResult<ConfigurationTreeItem[]> {
    if (element === undefined) {
      return [
        new ConfigurationTreeItem('Dummy Configurations'),
      ];
    }
    return [];
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class ConfigurationTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.configurations.tree.item';
  tooltip = 'This is a \nConfigurations Tree Item';
}
