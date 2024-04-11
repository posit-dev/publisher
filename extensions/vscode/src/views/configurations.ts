// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  FileSystemWatcher,
  InputBoxValidationSeverity,
  RelativePattern,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from "vscode";

import { useApi } from "../api";
import {
  Configuration,
  ConfigurationDetails,
  ConfigurationError,
  isConfigurationError,
} from "../api/types/configurations";

import { confirmDelete, confirmReplace } from "../dialogs";
import { getSummaryStringFromError } from "../utils/errors";
import { ensureSuffix, fileExists, isValidFilename } from "../utils/files";
import { untitledConfigurationName } from "../utils/names";

const viewName = "posit.publisher.configurations";
const refreshCommand = viewName + ".refresh";
const addCommand = viewName + ".add";
const editCommand = viewName + ".edit";
const cloneCommand = viewName + ".clone";
const renameCommand = viewName + ".rename";
const deleteCommand = viewName + ".delete";
const contextIsEmpty = viewName + ".isEmpty";
const fileStore = ".posit/publish/*.toml";

type ConfigurationEventEmitter = EventEmitter<
  ConfigurationTreeItem | undefined | void
>;
type ConfigurationEvent = Event<ConfigurationTreeItem | undefined | void>;

export class ConfigurationsTreeDataProvider
  implements TreeDataProvider<ConfigurationTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: ConfigurationEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: ConfigurationEvent =
    this._onDidChangeTreeData.event;

  constructor() {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  getTreeItem(element: ConfigurationTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element: ConfigurationTreeItem | undefined,
  ): Promise<ConfigurationTreeItem[]> {
    if (element !== undefined) {
      // Config elements have no children.
      return [];
    }
    const root = this.root;
    if (root === undefined) {
      // There can't be any configurations if we don't have a folder open.
      return [];
    }

    try {
      const response = await useApi().configurations.getAll();
      const configurations = response.data;
      await this.setContextIsEmpty(configurations.length === 0);

      return configurations.map((config) => {
        const fileUri = Uri.file(config.configurationPath);
        return new ConfigurationTreeItem(config, fileUri);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "configurations::getChildren",
        error,
      );
      window.showInformationMessage(summary);
      await this.setContextIsEmpty(true);
      return [];
    }
  }

  public register(context: ExtensionContext) {
    const treeView = window.createTreeView(viewName, {
      treeDataProvider: this,
    });

    context.subscriptions.push(
      treeView,
      commands.registerCommand(refreshCommand, this.refresh),
      commands.registerCommand(addCommand, this.add),
      commands.registerCommand(editCommand, this.edit),
      commands.registerCommand(renameCommand, this.rename),
      commands.registerCommand(cloneCommand, this.clone),
      commands.registerCommand(deleteCommand, this.delete),
    );
    if (this.root !== undefined) {
      context.subscriptions.push(this.createFileSystemWatcher(this.root));
    }
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void> {
    await commands.executeCommand(
      "setContext",
      contextIsEmpty,
      isEmpty ? "empty" : "notEmpty",
    );
  }

  private createFileSystemWatcher(root: WorkspaceFolder): FileSystemWatcher {
    const pattern = new RelativePattern(root, fileStore);
    const watcher = workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(this.refresh);
    watcher.onDidDelete(this.refresh);
    watcher.onDidChange(this.refresh);
    return watcher;
  }

  private refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  private add = async () => {
    let configName: string | undefined;
    try {
      const inspectResponse = await useApi().configurations.inspect();
      const config = await this.chooseConfig(inspectResponse.data);
      if (config === undefined) {
        // canceled
        return;
      }
      const defaultName = await untitledConfigurationName();
      configName = await window.showInputBox({
        value: defaultName,
        prompt: "Configuration name",
      });
      if (configName === undefined || configName === "") {
        // canceled
        return;
      }
      const createResponse = await useApi().configurations.createOrUpdate(
        configName,
        config,
      );
      if (this.root !== undefined) {
        const fileUri = Uri.file(createResponse.data.configurationPath);
        await commands.executeCommand("vscode.open", fileUri);
      }
      return createResponse.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("configurations::add", error);
      window.showInformationMessage(summary);
    }
    return undefined;
  };

  private edit = async (config: ConfigurationTreeItem) => {
    await commands.executeCommand("vscode.open", config.fileUri);
  };

  private rename = async (item: ConfigurationTreeItem) => {
    const defaultName = item.config.configurationName;
    const newUri = await this.promptForNewName(item.fileUri, defaultName);
    if (newUri === undefined) {
      return;
    }
    workspace.fs.rename(item.fileUri, newUri, { overwrite: true });
  };

  private clone = async (item: ConfigurationTreeItem) => {
    const defaultName = await untitledConfigurationName();
    const newUri = await this.promptForNewName(item.fileUri, defaultName);
    if (newUri === undefined) {
      return;
    }
    workspace.fs.copy(item.fileUri, newUri, { overwrite: true });
  };

  private async promptForNewName(
    oldUri: Uri,
    defaultName: string,
  ): Promise<Uri | undefined> {
    const newName = await window.showInputBox({
      value: defaultName,
      prompt: "New configuration name",
      validateInput: (filename) => {
        if (isValidFilename(filename)) {
          return undefined;
        } else {
          return {
            message: `Invalid Name: Cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
            severity: InputBoxValidationSeverity.Error,
          };
        }
      },
    });
    if (newName === undefined || newName === "") {
      // canceled
      return undefined;
    }

    const relativePath = "../" + ensureSuffix(".toml", newName);
    const newUri = Uri.joinPath(oldUri, relativePath);

    if (await fileExists(newUri)) {
      const ok = await confirmReplace(
        `Are you sure you want to replace the configuration '${newName}'?`,
      );
      if (!ok) {
        return undefined;
      }
    }
    return newUri;
  }

  private delete = async (item: ConfigurationTreeItem) => {
    const name = item.config.configurationName;
    const ok = await confirmDelete(
      `Are you sure you want to delete the configuration '${name}'?`,
    );
    if (ok) {
      try {
        await useApi().configurations.delete(name);
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "configurations::delete",
          error,
        );
        window.showInformationMessage(summary);
      }
    }
  };

  private chooseConfig = async (configs: ConfigurationDetails[]) => {
    if (configs.length === 1) {
      return configs[0];
    }
    const labels = configs.map(
      (config) => `${config.entrypoint} (type ${config.type})`,
    );
    const labelMap = new Map<string, ConfigurationDetails>();
    for (let i = 0; i < configs.length; i++) {
      labelMap.set(labels[i], configs[i]);
    }

    const selection = await window.showQuickPick(labels, {
      title: "Select main file and type",
    });
    if (selection === undefined) {
      return undefined;
    }
    return labelMap.get(selection);
  };
}

export class ConfigurationTreeItem extends TreeItem {
  contextValue = "posit.publisher.configurations.tree.item";

  constructor(
    public readonly config: Configuration | ConfigurationError,
    public readonly fileUri: Uri,
  ) {
    super(config.configurationName);

    if (isConfigurationError(config)) {
      this.iconPath = new ThemeIcon("warning");
    } else {
      this.iconPath = new ThemeIcon("gear");
    }
    this.tooltip = this.getTooltip();
    this.command = {
      title: "Open",
      command: "vscode.open",
      arguments: [this.fileUri],
    };
  }

  getTooltip(): string {
    let tooltip: string;

    if (isConfigurationError(this.config)) {
      tooltip =
        `Configuration file: ${this.config.configurationPath}\n` +
        `\n` +
        `Error: This configuration file is invalid.\n` +
        `Click to open it and resolve the underlined errors.\n` +
        `\n` +
        `Warning: This configuration will not be available for deployment operations\n` +
        `until the issue is resolved.`;
    } else {
      const c = this.config.configuration;

      tooltip =
        `Configuration file: ${this.config.configurationPath}\n` +
        `\n` +
        `Title: ${c.title}\n` +
        `Entrypoint File: ${c.entrypoint}\n` +
        `Content Type: ${c.type}`;

      const pyVersion = c.python?.version;
      if (pyVersion) {
        tooltip += `\nPython: ${pyVersion}`;
      }
      const rVersion = c.r?.version;
      if (rVersion) {
        tooltip += `\R: ${rVersion}`;
      }
    }
    return tooltip;
  }
}
