// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  FileSystemWatcher,
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

import { isAxiosError } from "axios";
import { isConfigurationError, useApi } from "../api";
import { confirmOverwrite } from "../dialogs";
import { getSummaryStringFromError } from "../utils/errors";
import { fileExists } from "../utils/files";
import { HomeViewState } from "./homeView";
import { useBus } from "../bus";

const viewName = "posit.publisher.requirements";
const editCommand = viewName + ".edit";
const refreshCommand = viewName + ".refresh";
const scanCommand = viewName + ".scan";
const contextIsEmpty = viewName + ".isEmpty";
const fileStore = "requirements.txt";

type RequirementsEventEmitter = EventEmitter<
  RequirementsTreeItem | undefined | void
>;
type RequirementsEvent = Event<RequirementsTreeItem | undefined | void>;

export class RequirementsTreeDataProvider
  implements TreeDataProvider<RequirementsTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private activeConfigName: string | undefined;

  private _onDidChangeTreeData: RequirementsEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: RequirementsEvent =
    this._onDidChangeTreeData.event;

  constructor(private readonly _context: ExtensionContext) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
    useBus().on("activeConfigurationChanged", (state: HomeViewState) => {
      console.log(
        `Requirements have been notified about the active configuration change, which is now: ${state.configuration.name}`,
      );
      if (state.configuration.name !== this.activeConfigName) {
        this.activeConfigName = state.configuration.name;
        this.refresh();
      }
    });
  }

  getTreeItem(element: RequirementsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element: RequirementsTreeItem | undefined,
  ): Promise<RequirementsTreeItem[]> {
    if (element !== undefined) {
      // Requirements items have no children.
      return [];
    }
    if (this.root === undefined) {
      // No workspace directory is available to read the data from.
      return [];
    }
    try {
      if (this.activeConfigName === undefined) {
        // We shouldn't get here if there's no configuration selected.
        await this.setContextIsEmpty(true);
        return [];
      }
      const api = await useApi();
      const response = await api.requirements.getByConfiguration(
        this.activeConfigName,
      );
      await this.setContextIsEmpty(false);
      return response.data.requirements.map(
        (line) => new RequirementsTreeItem(line),
      );
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        // No requirements file; show the welcome view.
        await this.setContextIsEmpty(true);
        return [];
      } else {
        const summary = getSummaryStringFromError(
          "requirements::getChildren",
          error,
        );
        window.showInformationMessage(summary);
        return [];
      }
    }
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void> {
    await commands.executeCommand(
      "setContext",
      contextIsEmpty,
      isEmpty ? "empty" : "notEmpty",
    );
  }

  public register() {
    this._context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this }),
    );

    if (this.root !== undefined) {
      this._context.subscriptions.push(
        commands.registerCommand(editCommand, this.edit),
        commands.registerCommand(refreshCommand, this.refresh),
        commands.registerCommand(scanCommand, this.scan),
        this.createFileSystemWatcher(this.root),
      );
    }
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
    useBus().trigger("requestActiveParams", undefined);
  };

  private getRequirementsFilename = async () => {
    if (this.activeConfigName === undefined) {
      // We shouldn't get here if there's no configuration selected.
      return undefined;
    }
    const api = await useApi();
    const response = await api.configurations.get(this.activeConfigName);
    const cfg = response.data;

    if (isConfigurationError(cfg)) {
      window.showErrorMessage(
        "The selected configuration is invalid. " +
          "Please correct errors in the configuration file and try again.",
      );
      return undefined;
    }

    // TODO: maybe don't show this view if the configuration doesn't include Python?
    if (!cfg.configuration.python) {
      window.showErrorMessage(
        "The selected configuration does not have a 'python' section. " +
          "Add Python to the configuration file, or select a different configuration, and try again.",
      );
      return undefined;
    }
    return cfg.configuration.python.packageFile;
  };

  private scan = async () => {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }

    const relPath = await this.getRequirementsFilename();
    if (relPath === undefined) {
      return;
    }

    const fileUri = Uri.joinPath(this.root.uri, relPath);

    if (await fileExists(fileUri)) {
      const ok = await confirmOverwrite(
        `Are you sure you want to overwrite your existing ${relPath} file?`,
      );
      if (!ok) {
        return;
      }
    }

    try {
      const api = await useApi();
      await api.requirements.create(relPath);
      await commands.executeCommand("vscode.open", fileUri);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("dependencies::scan", error);
      window.showInformationMessage(summary);
    }
  };

  private edit = async () => {
    if (this.root === undefined) {
      return;
    }

    const relPath = await this.getRequirementsFilename();
    if (relPath === undefined) {
      return;
    }
    const fileUri = Uri.joinPath(this.root.uri, relPath);
    await commands.executeCommand("vscode.open", fileUri);
  };
}

export class RequirementsTreeItem extends TreeItem {
  constructor(itemString: string) {
    super(itemString);

    if (itemString.startsWith("-")) {
      // Looks like a pip configuration parameter, e.g. --index-url
      this.iconPath = new ThemeIcon("gear");
    } else {
      this.iconPath = new ThemeIcon("package");
    }
  }

  contextValue = "posit.publisher.dependencies.tree.item";
  tooltip = "";
}
