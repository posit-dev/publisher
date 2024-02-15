import * as vscode from 'vscode'
import * as path from 'path';
import { BaseViewProvider } from './BaseViewProvider'
import { TreeDataProvider, TreeItem } from './treeProvider';

const configs: TreeItem[] = [
	new TreeItem('publisherConfig', 'Default.toml', [
		new TreeItem('publisherConfig', 'Title: ABC'),
		new TreeItem('publisherConfig', 'Desc: A bit more info…'),
	]),
	new TreeItem('publisherConfig', 'Production.toml', [
		new TreeItem('publisherConfig', 'Title: ABC'),
		new TreeItem('publisherConfig', 'Desc: Production Quality stuff!'),
	])
];

export function activate(context: vscode.ExtensionContext) {
	const provider1 = new BaseViewProvider(context.extensionUri, 'dist/compiled/webViewView1', 'base-view-sidebar-1')

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('base-view-sidebar-1', provider1));

  const provider2 = new BaseViewProvider(context.extensionUri, 'dist/compiled/webViewView2', 'base-view-sidebar-2')

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('base-view-sidebar-2', provider2));
  
  const configProvider = new TreeDataProvider(configs);
  vscode.window.registerTreeDataProvider('publisherConfig', configProvider);
  vscode.commands.registerCommand('publisherConfig.refreshEntry', () => configProvider.refresh());
  vscode.commands.registerCommand('publisherConfig.addEntry', () => vscode.window.showInformationMessage(`Successfully called add entry.`));
  vscode.commands.registerCommand('publisherConfig.editEntry', (node: Config) => vscode.window.showInformationMessage(`Successfully called edit entry on ${node.name}.`));
  vscode.commands.registerCommand('publisherConfig.deleteEntry', (node: Config) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.name}.`));
    
}

export class Config extends vscode.TreeItem {

	constructor(
		public readonly name: string,
		private readonly projectPath?: string,
		public readonly entries?: Config[],
		public readonly command?: vscode.Command
	) {
		super(
			name,
			entries ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
		);
		this.entries = entries;
		this.tooltip = this.projectPath;
		// this.description = `Publishing configuration file ${this.configPath}`;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'config';
}