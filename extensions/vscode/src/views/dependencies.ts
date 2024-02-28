// Copyright (C) 2024 by Posit Software, PBC.

import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.dependencies';

export class DependenciesTreeDataProvider implements TreeDataProvider<DependenciesTreeItem> {

  constructor() { }

  getTreeItem(element: DependenciesTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: DependenciesTreeItem | undefined): ProviderResult<DependenciesTreeItem[]> {
    if (element === undefined) {
      return [
        new DependenciesTreeItem('Dummy Dependencies'),
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

export class DependenciesTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.dependencies.tree.item';
  tooltip = 'This is a \nDependencies Tree Item';
}
