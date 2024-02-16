import * as vscode from 'vscode';
import * as path from 'path';

import api from '../api';
import { Configuration, isConfigurationError } from "../api/types/configurations";
import { confirmDelete } from './confirm';

const viewName = 'posit.publisher.configurations';
const editCommand = 'posit.publisher.configurations.edit';
const deleteCommand = 'posit.publisher.configurations.delete';
const fileStore = '.posit/publish/*.toml';

export class ConfigurationsProvider implements vscode.TreeDataProvider<ConfigurationBaseNode> {

    private _onDidChangeTreeData: vscode.EventEmitter<ConfigurationBaseNode | undefined | void> = new vscode.EventEmitter<ConfigurationBaseNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigurationBaseNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfigurationBaseNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConfigurationBaseNode): Promise<ConfigurationBaseNode[]> {
        const root = this.workspaceRoot;
        if (!root) {
            return [];
        }
        if (element) {
            // Config elements have no children.
            return [];
        }
        return api.configurations.getAll().then(response => {
            const data = response.data;
            return data.map(configOrError => {
                const fullPath = path.join(this.workspaceRoot || "", configOrError.configurationPath);

                if (isConfigurationError(configOrError)) {
                    return new ConfigErrorNode(configOrError.configurationName, fullPath);
                } else {
                    return new ConfigurationNode(configOrError.configurationName, fullPath);
                }
            });
        });
    }

    public register(context: vscode.ExtensionContext): any {
        vscode.window.registerTreeDataProvider(viewName, this);
        context.subscriptions.push(
            vscode.window.createTreeView(viewName, { treeDataProvider: this })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand(deleteCommand, async (config: ConfigurationBaseNode) => {
                const ok = await confirmDelete("Really delete this configuration?");
                if (ok) {
                    await api.configurations.delete(config.name);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand(editCommand, async (config: ConfigurationBaseNode) => {
                const uri = vscode.Uri.file(config.filePath);
                await vscode.commands.executeCommand('vscode.open', uri);
            })
        );

        if (this.workspaceRoot !== undefined) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this.workspaceRoot, fileStore));
            watcher.onDidCreate(_ => {
                this.refresh();
            });
            watcher.onDidDelete(_ => {
                this.refresh();
            });
            watcher.onDidChange(_ => {
                this.refresh();
            });
            context.subscriptions.push(watcher);
        }
    }
}

export class ConfigurationBaseNode extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly filePath: string
    ) {
        super(name);

        this.tooltip = this.filePath;
    }
};

export class ConfigurationNode extends ConfigurationBaseNode {
    constructor(name: string, filePath: string) {
        super(name, filePath);

        this.iconPath = new vscode.ThemeIcon('gear');
        this.contextValue = 'configuration';
    }
}

export class ConfigErrorNode extends ConfigurationBaseNode {
    constructor(name: string, filePath: string) {
        super(name, filePath);

        this.iconPath = new vscode.ThemeIcon('warning');
        this.contextValue = 'configurationError';
    }
}
