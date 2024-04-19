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
import { Configuration, useApi } from "../api";
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

type RequirementsEventEmitter = EventEmitter<
  RequirementsTreeItem | undefined | void
>;
type RequirementsEvent = Event<RequirementsTreeItem | undefined | void>;

export class RequirementsTreeDataProvider
  implements TreeDataProvider<RequirementsTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private activeConfig: Configuration | undefined;
  private activeConfigName: string | undefined;
  private fileWatcher: FileSystemWatcher | undefined;

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
        `Requirements have been notified about the active configuration change, which is now: ${state.configuration.name} (was ${this.activeConfigName})`,
      );
      if (
        state.configuration.name !== this.activeConfigName ||
        state.configuration.value !== this.activeConfig
      ) {
        this.activeConfigName = state.configuration.name;
        this.activeConfig = state.configuration.value;
        this._onDidChangeTreeData.fire();

        if (this.root !== undefined) {
          this.createFileSystemWatcher(this.root);
        }
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
      console.log(
        "requirements::getChildren: activeConfigName",
        this.activeConfigName,
      );
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
      );
      this.createFileSystemWatcher(this.root);
    }
  }

  private createFileSystemWatcher(root: WorkspaceFolder) {
    const fileStore =
      this.activeConfig?.configuration.python?.packageFile ||
      "requirements.txt";
    const pattern = new RelativePattern(root, fileStore);
    const watcher = workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(this.refresh);
    watcher.onDidDelete(this.refresh);
    watcher.onDidChange(this.refresh);

    if (this.fileWatcher !== undefined) {
      // Dispose of the old watcher, and tell VSCode to forget about it.
      this.fileWatcher.dispose();
      const index = this._context.subscriptions.indexOf(this.fileWatcher);
      if (index !== -1) {
        this._context.subscriptions.splice(index, 1);
      }
    }
    this._context.subscriptions.push(watcher);
    this.fileWatcher = watcher;
  }

  private refresh = () => {
    useBus().trigger("requestActiveParams", undefined);
    this._onDidChangeTreeData.fire();
  };

  private getRequirementsFilename() {
    return this.activeConfig?.configuration.python?.packageFile;
  }

  private scan = async () => {
    if (this.root === undefined) {
      // We shouldn't get here if there's no workspace folder open.
      return;
    }

    const relPath = this.getRequirementsFilename();
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

    const relPath = this.getRequirementsFilename();
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
