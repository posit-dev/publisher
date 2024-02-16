import * as vscode from 'vscode';
import * as path from 'path';

import api from '../api';
import { Configuration, isConfigurationError } from "../api/types/configurations";
import { confirmDelete } from './confirm';

const viewName = 'posit.publisher.config';
const editCommand = 'posit.publisher.config.edit';
const deleteCommand = 'posit.publisher.config.delete';

export class ConfigNodeProvider implements vscode.TreeDataProvider<Config | ConfigError> {

    private _onDidChangeTreeData: vscode.EventEmitter<Config | undefined | void> = new vscode.EventEmitter<Config | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<Config | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) {
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Config): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: Config): Promise<(Config | ConfigError)[]> {
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
                    return new ConfigError(configOrError.configurationName, fullPath);
                } else {
                    const config = configOrError as Configuration;
                    return new Config(config.configurationName, fullPath);
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
            vscode.commands.registerCommand(deleteCommand, async config => {
                const ok = await confirmDelete("Really delete this configuration?");
                if (ok) {
                    await api.configurations.delete(config.name);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand(editCommand, async config => {
                const uri = vscode.Uri.file(config.configPath);
                await vscode.commands.executeCommand('vscode.open', uri);
            })
        );

        if (this.workspaceRoot !== undefined) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this.workspaceRoot, ".posit/publish/*.toml"));
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

export class ConfigNode extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        protected readonly configPath: string
    ) {
        super(name);

        this.tooltip = this.configPath;
        // this.description = `Publishing configuration file ${this.configPath}`;
    }
};

export class Config extends ConfigNode {
    constructor(name: string, configPath: string) {
        super(name, configPath);

        this.tooltip = this.configPath;
        this.iconPath = new vscode.ThemeIcon('gear');
        this.contextValue = 'configuration';
    }
}

export class ConfigError extends ConfigNode {
    constructor(name: string, configPath: string) {
        super(name, configPath);

        this.tooltip = this.configPath;
        this.iconPath = new vscode.ThemeIcon('warning');
        this.contextValue = 'configurationError';
    }
}
