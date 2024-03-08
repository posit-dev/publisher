// Copyright (C) 2024 by Posit Software, PBC.

import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from 'vscode';

const viewName = 'posit.publisher.project';

export class ProjectTreeDataProvider implements TreeDataProvider<ProjectTreeItem> {

  constructor() { }

  getTreeItem(element: ProjectTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(_: ProjectTreeItem | undefined): ProviderResult<ProjectTreeItem[]> {
    return [];
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class ProjectTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.project.tree.item';
  tooltip = 'This is a \nProject Tree Item';
}
