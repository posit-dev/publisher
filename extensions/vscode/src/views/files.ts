// Copyright (C) 2024 by Posit Software, PBC.

import { DeploymentFile, ExclusionMatch } from "../api/types/files";
import { useApi } from "../api";
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
import { getSummaryStringFromError } from "../utils/errors";
import * as path from "path";
import { updateNewOrExistingFile, pathSorter } from "../utils/files";

import * as os from "os";

const viewName = "posit.publisher.files";
const refreshCommand = viewName + ".refresh";
const editPositIgnoreCommand = viewName + ".editPositIgnore";
const addExclusionCommand = viewName + ".addExclusion";

const isIncludedTitle = viewName + ".isIncludedTitle";
const isExcludedTitle = viewName + ".isExcludedTitle";
const isIncludedFile = viewName + ".isIncludedFile";
const isExcludedFile = viewName + ".isExcludedFile";
const isEmptyContext = viewName + ".isEmpty";

const positIgnoreFileTemplate =
  `#\n` +
  `# Posit Publishing Ignore File (.positignore)\n` +
  `#\n` +
  `# Controls which files will be uploaded to the server within\n` +
  `# the bundle during the next deployment.\n` +
  `#\n` +
  `# Syntax of exclusions conforms with Git Ignore File syntax.\n` +
  `#\n` +
  `# NOTE: This file currenly only supports POSITIVE exclusion rules\n` +
  `# and does not support NEGATIVE inclusion rules.\n` +
  `#\n` +
  `\n`;

let includedFiles: FileEntries[] = [];
let excludedFiles: FileEntries[] = [];

type FilesEventEmitter = EventEmitter<TreeEntries | undefined | void>;
type FilesEvent = Event<TreeEntries | undefined | void>;

export class FilesTreeDataProvider implements TreeDataProvider<TreeEntries> {
  private root: Uri;
  private _onDidChangeTreeData: FilesEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: FilesEvent = this._onDidChangeTreeData.event;

  private api = useApi();

  constructor() {
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
        const response = await this.api.files.get();
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

  public register(context: ExtensionContext) {
    const treeView = window.createTreeView(viewName, {
      treeDataProvider: this,
    });
    context.subscriptions.push(treeView);
    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );
    context.subscriptions.push(
      commands.registerCommand(editPositIgnoreCommand, async () => {
        if (this.root !== undefined) {
          updateNewOrExistingFile(
            path.join(this.root.fsPath, ".positignore"),
            positIgnoreFileTemplate,
            undefined, // No suffix
            true, // open file preview after update
          );
        }
      }),
    );
    context.subscriptions.push(
      commands.registerCommand(
        addExclusionCommand,
        async (item: FileTreeItem) => {
          if (this.root !== undefined) {
            updateNewOrExistingFile(
              path.join(this.root.fsPath, ".positignore"),
              positIgnoreFileTemplate,
              `${item.id}\n`,
              true, // open file preview after update
            );
          }
        },
      ),
    );

    if (this.root !== undefined) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, "**"),
      );
      watcher.onDidCreate(this.refresh);
      watcher.onDidDelete(this.refresh);
      watcher.onDidChange(this.refresh);
      context.subscriptions.push(watcher);
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

const buildFileTrees = (
  file: DeploymentFile,
  root: Uri,
  // Workaround for API shortcoming which does not populate exclusions down through
  // subdirectories. Once API has been updated for that, we can remove the override
  // (although it will continue to function correctly as written)
  exclusionOverride?: ExclusionMatch | null,
) => {
  if (file.isFile) {
    if (file.exclusion || exclusionOverride) {
      const f = new ExcludedFile(root, {
        ...file,
        exclusion: file.exclusion || exclusionOverride || null,
      });
      excludedFiles.push(f);
    } else {
      const f = new IncludedFile(root, file);
      includedFiles.push(f);
    }
  } else {
    // We're not showing our .posit subdirectory, but it will be included
    // in the deployment bundle unless they explicitly exclude it in the
    // .positignore.
    if (file.id === ".posit") {
      return;
    }
  }

  file.files.forEach((d) => {
    buildFileTrees(d, root, file.exclusion || exclusionOverride);
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
  public exclusion: ExclusionMatch | null;

  constructor(root: Uri, deploymentFile: DeploymentFile) {
    super(deploymentFile.base);

    this.id = deploymentFile.id;
    this.label = deploymentFile.base;
    this.fileUri = Uri.file(path.join(root.fsPath, deploymentFile.id));
    this.collapsibleState = TreeItemCollapsibleState.None;
    this.exclusion = deploymentFile.exclusion;
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
    this.tooltip = `This file will be included in the next deployment.\n${this.fileUri.fsPath}`;
  }
}
export class ExcludedFile extends FileTreeItem {
  constructor(root: Uri, deploymentFile: DeploymentFile) {
    super(root, deploymentFile);

    this.contextValue = isExcludedFile;
    this.resourceUri = Uri.parse(`positPublisherFilesExcluded://${this.id}`);
    this.tooltip = `This file will be excluded in the next deployment.\n${this.fileUri.fsPath}\n\n`;
    if (this.exclusion) {
      if (this.exclusion.source === "built-in") {
        this.tooltip += `This is a built-in exclusion for the pattern: '${this.exclusion?.pattern}'`;
      } else {
        this.tooltip += `The project's .positignore file is excluding it\nwith the pattern '${this.exclusion?.pattern}' on line #${this.exclusion?.line}`;
      }
    }
  }
}
