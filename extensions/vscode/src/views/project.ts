import * as vscode from 'vscode';

const viewName = 'posit.publisher.project';

export class ProjectTreeDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {

  constructor() { }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element: ProjectTreeItem | undefined): vscode.ProviderResult<ProjectTreeItem[]> {
    if (element === undefined) {
      return [
        new ProjectTreeItem('Dummy Project'),
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

export class ProjectTreeItem extends vscode.TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.project.tree.item';
  tooltip = 'This is a \nProject Tree Item';
}
