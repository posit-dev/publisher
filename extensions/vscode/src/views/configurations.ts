// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  InputBoxValidationSeverity,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from "vscode";

import {
  useApi,
  Configuration,
  ConfigurationError,
  isConfigurationError,
} from "src/api";

import { confirmDelete, confirmReplace } from "src/dialogs";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  ensureSuffix,
  fileExists,
  isRelativePathRoot,
  isValidFilename,
} from "src/utils/files";
import { untitledConfigurationName } from "src/utils/names";
import { newConfig } from "src/multiStepInputs/newConfig";
import { WatcherManager } from "src/watchers";
import { Commands, Contexts, Views } from "src/constants";

type ConfigurationEventEmitter = EventEmitter<
  ConfigurationTreeItem | undefined | void
>;
type ConfigurationEvent = Event<ConfigurationTreeItem | undefined | void>;

export class ConfigurationsTreeDataProvider
  implements TreeDataProvider<ConfigurationTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private treeDataChangeEventEmitter: ConfigurationEventEmitter =
    new EventEmitter();
  readonly onDidChangeTreeData: ConfigurationEvent =
    this.treeDataChangeEventEmitter.event;

  constructor(private readonly context: ExtensionContext) {
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
      const api = await useApi();
      const response = await api.configurations.getAll({
        dir: ".",
        recursive: true,
      });
      const configurations = response.data;

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
      return [];
    }
  }

  public register(watchers: WatcherManager) {
    const treeView = window.createTreeView(Views.Configurations, {
      treeDataProvider: this,
    });

    this.context.subscriptions.push(
      treeView,
      commands.registerCommand(Commands.Configurations.Refresh, this.refresh),
      commands.registerCommand(Commands.Configurations.New, this.add),
      commands.registerCommand(Commands.Configurations.Edit, this.edit),
      commands.registerCommand(Commands.Configurations.Rename, this.rename),
      commands.registerCommand(Commands.Configurations.Clone, this.clone),
      commands.registerCommand(Commands.Configurations.Delete, this.delete),
    );

    watchers.positDir?.onDidDelete(this.refresh, this);
    watchers.publishDir?.onDidDelete(this.refresh, this);

    watchers.configurations?.onDidCreate(this.refresh, this);
    watchers.configurations?.onDidDelete(this.refresh, this);
    watchers.configurations?.onDidChange(this.refresh, this);
  }

  private refresh = () => {
    this.treeDataChangeEventEmitter.fire();
  };

  private add = async (viewId?: string) => {
    // We only create a new configuration through this
    // command. We do not associate it automatically with
    // the current deployment
    await newConfig(
      "Create a Configuration File for your Project",
      viewId ? viewId : Views.Configurations,
    );
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
    const defaultName = await untitledConfigurationName(item.config.projectDir);
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
            message: `Error: Invalid Name: Cannot be all spaces, '.' or contain '..' or any of these characters: /:*?"<>|\\`,
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
    const config = item.config;
    const name = config.configurationName;
    const ok = await confirmDelete(
      `Are you sure you want to delete the configuration '${name}'?`,
    );
    if (ok) {
      try {
        const api = await useApi();
        await api.configurations.delete(name, {
          dir: config.projectDir,
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "configurations::delete",
          error,
        );
        window.showInformationMessage(summary);
      }
    }
  };
}

export class ConfigurationTreeItem extends TreeItem {
  contextValue = Contexts.Configurations.TreeItem;

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
    this.description = isRelativePathRoot(config.projectDir)
      ? undefined
      : config.projectDir;
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
        `Configuration file: ${this.config.configurationRelPath}\n` +
        `\n` +
        `Error: This configuration file is invalid.\n` +
        `Click to open it and resolve the underlined errors.\n` +
        `\n` +
        `Warning: This configuration will not be available for deployment operations\n` +
        `until the issue is resolved.`;
    } else {
      const c = this.config.configuration;

      tooltip =
        `Configuration file: ${this.config.configurationRelPath}\n` +
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
