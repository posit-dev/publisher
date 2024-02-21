import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.credentials';

export class CredentialsTreeDataProvider implements TreeDataProvider<CredentialsTreeItem> {

  constructor() { }

  getTreeItem(element: CredentialsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: CredentialsTreeItem | undefined): ProviderResult<CredentialsTreeItem[]> {
    if (element === undefined) {
      return [
        new CredentialsTreeItem('Dummy Credentials'),
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
export class CredentialsTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.credentials.tree.item';
  tooltip = 'This is a \nCredentials Tree Item';
}
