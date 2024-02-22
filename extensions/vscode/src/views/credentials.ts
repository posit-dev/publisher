import {
  TreeDataProvider,
  TreeItem,
  ExtensionContext,
  window,
} from 'vscode';

import api from '../api';

const viewName = 'posit.publisher.credentials';

export class CredentialsTreeDataProvider implements TreeDataProvider<CredentialsTreeItem> {

  constructor() { }

  getTreeItem(element: CredentialsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: CredentialsTreeItem | undefined): Promise<CredentialsTreeItem[]> {
    if (element) {
      return [];
    }

    const response = await api.accounts.getAll();
    const accounts = response.data.accounts;
    return accounts.map(account => {
      return new CredentialsTreeItem(account.name);
    });
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
