import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.deployments';

export class DeploymentsTreeDataProvider implements TreeDataProvider<DeploymentsTreeItem> {

  constructor() { }

  getTreeItem(element: DeploymentsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }
  getChildren(element: DeploymentsTreeItem | undefined): ProviderResult<DeploymentsTreeItem[]> {
    if (element === undefined) {
      return [
        new DeploymentsTreeItem('Dummy Deployments'),
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

export class DeploymentsTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.deployments.tree.item';
  tooltip = 'This is a \nDeployments Tree Item';
}
