// Copyright (C) 2024 by Posit Software, PBC.

import {
  TreeDataProvider,
  TreeItem,
  ProviderResult,
  ExtensionContext,
  window,
} from "vscode";

import { Views } from "src/constants";

export class ProjectTreeDataProvider
  implements TreeDataProvider<ProjectTreeItem>
{
  constructor(private readonly _context: ExtensionContext) {}

  getTreeItem(element: ProjectTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(
    _: ProjectTreeItem | undefined,
  ): ProviderResult<ProjectTreeItem[]> {
    return [];
  }

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(Views.Project, { treeDataProvider: this }),
    );
  }
}

export class ProjectTreeItem extends TreeItem {
  constructor(itemString: string) {
    super(itemString);
  }
}
