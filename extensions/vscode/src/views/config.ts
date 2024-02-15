import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import api from "../api";
import { Configuration, isConfigurationError } from "../api/types/configurations";

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

    getChildren(element?: Config): Thenable<(Config | ConfigError)[]> {
        const root = this.workspaceRoot;
        if (!root) {
            return Promise.resolve([]);
        }
        if (element) {
            // Config elements have no children.
            return Promise.resolve([]);
        }
        return api.configurations.getAll().then(response => {
            const data = response.data;
            return Promise.resolve(data.map(configOrError => {
                const fullPath = path.join(this.workspaceRoot || "", configOrError.configurationPath);

                if (isConfigurationError(configOrError)) {
                    return new ConfigError(configOrError.configurationName, fullPath);
                } else {
                    const config = configOrError as Configuration;
                    return new Config(config.configurationName, fullPath);
                }
            }));
        });
    }

    public register(context: vscode.ExtensionContext): any {
        const viewName = 'posit-publisher-config';
        const options = {
            treeDataProvider: this,
        };

        vscode.window.registerTreeDataProvider(viewName, this);
        const tree = vscode.window.createTreeView(viewName, options);

        tree.onDidChangeSelection(e => {
            console.log(e);
            if (e.selection.length > 0) {
                e.selection.at(0)?.edit();
            }
        });
        context.subscriptions.push(tree);
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

    edit() {
        const openPath = vscode.Uri.file(this.configPath);
        vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
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
