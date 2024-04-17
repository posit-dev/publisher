// Copyright (C) 2024 by Posit Software, PBC.

import { DeploymentFile, FileMatch } from "../api/types/files";
import {
  TreeDataProvider,
  TreeItem,
  ExtensionContext,
  window,
  EventEmitter,
  Event,
  workspace,
  TreeItemCollapsibleState,
  Uri,
  commands,
  ThemeIcon,
  RelativePattern,
} from "vscode";
import { useApi } from "../api";
import { getSummaryStringFromError } from "../utils/errors";
import * as path from "path";
import { pathSorter } from "../utils/files";

import * as os from "os";

const viewName = "posit.publisher.files";
const refreshCommand = viewName + ".refresh";

const isIncludedTitle = viewName + ".isIncludedTitle";
const isExcludedTitle = viewName + ".isExcludedTitle";
const isIncludedFile = viewName + ".isIncludedFile";
const isExcludedFile = viewName + ".isExcludedFile";
const isEmptyContext = viewName + ".isEmpty";

let includedFiles: FileEntries[] = [];
let excludedFiles: FileEntries[] = [];

type FilesEventEmitter = EventEmitter<TreeEntries | undefined | void>;
type FilesEvent = Event<TreeEntries | undefined | void>;

export class FilesTreeDataProvider implements TreeDataProvider<TreeEntries> {
  private root: Uri;
  private _onDidChangeTreeData: FilesEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: FilesEvent = this._onDidChangeTreeData.event;

  constructor(private readonly _context: ExtensionContext) {
    const workspaceFolders = workspace.workspaceFolders;
    this.root = Uri.parse("positPublisherFiles://unknown");
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0].uri;
    }
  }

  public refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  getTreeItem(element: FileEntries): FileEntries | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: TreeEntries | undefined): Promise<TreeEntries[]> {
    if (element === undefined) {
      // first call.
      try {
        const api = await useApi();
        const response = await api.files.getByConfiguration("default");
        const file = response.data;

        commands.executeCommand("setContext", isEmptyContext, Boolean(file));

        resetFileTrees();
        // skipping the top level
        file.files.forEach((f) => buildFileTrees(f, this.root));
        sortFileTrees();

        // we have a fixed top hiearchy
        return [
          new IncludedFilesSection(`Included Files`),
          new ExcludedFilesSection(`Excluded Files`),
        ];
      } catch (error: unknown) {
        const summary = getSummaryStringFromError("files::getChildren", error);
        commands.executeCommand("setContext", isEmptyContext, true);
        window.showInformationMessage(summary);
        return [];
      }
    }
    if (element instanceof IncludedFilesSection) {
      return includedFiles;
    } else if (element instanceof ExcludedFilesSection) {
      return excludedFiles;
    }
    // should be flat below the actual files
    return [];
  }

  public register() {
    const treeView = window.createTreeView(viewName, {
      treeDataProvider: this,
    });
    this._context.subscriptions.push(treeView);
    this._context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );

    if (this.root !== undefined) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, "**"),
      );
      watcher.onDidCreate(this.refresh);
      watcher.onDidDelete(this.refresh);
      watcher.onDidChange(this.refresh);
      this._context.subscriptions.push(watcher);
    }
  }
}

function sortFilesTreeItemByPath(a: FileTreeItem, b: FileTreeItem) {
  const sep: string = os.platform() === "win32" ? "\\" : "/";
  if (a.fileUri.fsPath && b.fileUri.fsPath) {
    return pathSorter(a.fileUri.fsPath.split(sep), b.fileUri.fsPath.split(sep));
  }
  return 0;
}

const sortFileTrees = () => {
  includedFiles.sort(sortFilesTreeItemByPath);
  excludedFiles.sort(sortFilesTreeItemByPath);
};

const resetFileTrees = () => {
  includedFiles = [];
  excludedFiles = [];
};

const buildFileTrees = (file: DeploymentFile, root: Uri) => {
  if (file.isFile) {
    if (file.reason?.exclude === false) {
      const f = new IncludedFile(root, {
        ...file,
        reason: file.reason,
      });
      includedFiles.push(f);
    } else {
      const f = new ExcludedFile(root, {
        ...file,
        reason: file.reason || null,
      });
      excludedFiles.push(f);
    }
  } else {
    // We're not showing our .posit subdirectory.
    if (file.id === ".posit") {
      return;
    }
  }

  file.files.forEach((d) => {
    buildFileTrees(d, root);
  });
};

export type TreeEntries =
  | IncludedFilesSection
  | ExcludedFilesSection
  | FileEntries;
export type FileEntries = IncludedFile | ExcludedFile;

export class IncludedFilesSection extends TreeItem {
  constructor(label: string) {
    super(label);

    this.contextValue = isIncludedTitle;
    this.resourceUri = Uri.parse(`positPublisherFiles://includedTitle`);
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
    this.tooltip = `Files listed within this tree node will be uploaded during the next deployment.`;
    this.iconPath = new ThemeIcon("list-unordered");
  }
}
export class ExcludedFilesSection extends TreeItem {
  constructor(label: string) {
    super(label);

    this.contextValue = isExcludedTitle;
    this.resourceUri = Uri.parse(`positPublisherFiles://excludedTitle`);
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
    this.tooltip = `Files listed within this tree node will not be uploaded during the next deployment.`;
    this.iconPath = new ThemeIcon("list-unordered");
  }
}

export class FileTreeItem extends TreeItem {
  public fileUri: Uri;
  public reason: FileMatch | null;

  constructor(root: Uri, deploymentFile: DeploymentFile) {
    super(deploymentFile.base);

    this.id = deploymentFile.id;
    this.label = deploymentFile.base;
    this.fileUri = Uri.file(path.join(root.fsPath, deploymentFile.id));
    this.collapsibleState = TreeItemCollapsibleState.None;
    this.reason = deploymentFile.reason;
    this.command = {
      title: "Open",
      command: "vscode.open",
      arguments: [this.fileUri],
    };
    this.description = path.dirname(deploymentFile.id);
    if (this.description === ".") {
      this.description = undefined;
    }

    this.iconPath = new ThemeIcon("debug-stackframe-dot");
  }
}

export class IncludedFile extends FileTreeItem {
  constructor(root: Uri, deploymentFile: DeploymentFile) {
    super(root, deploymentFile);
    this.contextValue = isIncludedFile;
    this.resourceUri = Uri.parse(`positPublisherFilesIncluded://${this.id}`);
    this.tooltip = `This file will be included in the next deployment.\n${deploymentFile.rel}\n\n`;
    if (this.reason) {
      this.tooltip += `The configuration file ${this.reason.fileName} is including it with the pattern '${this.reason.pattern}'`;
    }
  }
}
export class ExcludedFile extends FileTreeItem {
  constructor(root: Uri, deploymentFile: DeploymentFile) {
    super(root, deploymentFile);

    this.contextValue = isExcludedFile;
    this.resourceUri = Uri.parse(`positPublisherFilesExcluded://${this.id}`);
    this.tooltip = `This file will be excluded in the next deployment.\n${deploymentFile.rel}\n\n`;
    if (this.reason) {
      if (this.reason.source === "built-in") {
        this.tooltip += `This is a built-in exclusion for the pattern: '${this.reason.pattern}'`;
      } else {
        this.tooltip += `The configuration file ${this.reason.fileName} is excluding it with the pattern '${this.reason.pattern}'`;
      }
    } else {
      this.tooltip += `It did not match any pattern in the configuration 'files' list.`;
    }
  }
}
