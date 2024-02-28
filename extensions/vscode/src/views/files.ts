// Copyright (C) 2024 by Posit Software, PBC.

import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.files';

export class FilesTreeDataProvider implements TreeDataProvider<FilesTreeItem> {

  constructor() { }

  getTreeItem(element: FilesTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: FilesTreeItem | undefined): ProviderResult<FilesTreeItem[]> {
    if (element === undefined) {
      return [
        new FilesTreeItem('Dummy File'),
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

export class FilesTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.files.tree.item';
  tooltip = 'This is a \nFiles Tree Item';
}
