import * as vscode from 'vscode';
import * as path from 'path';

// export function activate(context: vscode.ExtensionContext) {
//   vscode.window.registerTreeDataProvider('carView', new TreeDataProvider(cars));
// }

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  onDidChangeTreeData?: vscode.Event<TreeItem|null|undefined>|undefined;

  data: TreeItem[];

  constructor(data: TreeItem[]) {
    this.data = data;
  }

  getTreeItem(element: TreeItem): vscode.TreeItem|Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem|undefined): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }

	refresh(): void {
	}
}

export class TreeItem extends vscode.TreeItem {
  children: TreeItem[]|undefined;

  constructor(context: string, label: string, children?: TreeItem[]) {
    super(
			{label: label, highlights:[[0,2],[5,12]]},
			children === undefined ? vscode.TreeItemCollapsibleState.None :
																vscode.TreeItemCollapsibleState.Expanded
		);
    this.children = children;
		this.contextValue = context;
		this.description = 'abc';
		this.checkboxState = vscode.TreeItemCheckboxState.Checked;
  }

	iconPath = {
		light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	tooltip = 'This is a \nMulti-line\nTooltip';
}
