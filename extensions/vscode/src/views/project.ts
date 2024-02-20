import * as vscode from 'vscode';

const viewName = 'posit.publisher.project.provider';

export class ProjectTreeDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

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

  getParent?(element: ProjectTreeItem): vscode.ProviderResult<ProjectTreeItem> {
    return element;
  }

  resolveTreeItem?(_1: vscode.TreeItem, _2: ProjectTreeItem, _3: vscode.CancellationToken): vscode.ProviderResult<ProjectTreeItem> {
    throw new Error('Method not implemented.');
  }

  public register(context: vscode.ExtensionContext): any {
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
