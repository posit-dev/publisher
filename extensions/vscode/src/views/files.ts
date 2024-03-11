// Copyright (C) 2024 by Posit Software, PBC.

import { DeploymentFile, ExclusionMatch } from '../api/types/files';
import { useApi } from '../api';
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
} from 'vscode';
import { getSummaryStringFromError } from '../utils/errors';
import * as path from 'path';
import {
  updateNewOrExistingFile,
  pathSorter,
} from '../utils/files';

enum FileItemTreeMode {
  includedTitle,
  excludedTitle,
  includedFile,
  excludedFile,
}

const viewName = 'posit.publisher.files';
const refreshCommand = viewName + '.refresh';
const editCommand = viewName + '.edit';
const editPositIgnoreCommand = viewName + '.editPositIgnore';
const addExclusionCommand = viewName + '.addExclusion';

const isIncludedTitle = viewName + '.isIncludedTitle';
const isExcludedTitle = viewName + '.isExcludedTitle';
const isIncludedFile = viewName + '.isIncludedFile';
const isExcludedFile = viewName + '.isExcludedFile';
const isEmptyContext = viewName + '.isEmpty';

const positIgnoreFileTemplate =
  `#\n` +
  `# Posit Publishing Ignore File (.positignore)\n` +
  `#\n` +
  `# Controls which files will be uploaded to the server within\n` +
  `# the bundle during the next deployment.\n` +
  `#\n` +
  `# Syntax of exclusions conforms with Git Ignore File syntax.` +
  `#\n` +
  `# NOTE: This file currenly only supports POSITIVE exclusion rules\n` +
  `# and does not support NEGATIVE inclusion rules.\n` +
  `#\n` +
  `\n`;

type FilesEventEmitter = EventEmitter<FilesTreeItem | undefined | void>;
type FilesEvent = Event<FilesTreeItem | undefined | void>;

export class FilesTreeDataProvider implements TreeDataProvider<FilesTreeItem> {
  private root: Uri;
  private _onDidChangeTreeData: FilesEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: FilesEvent = this._onDidChangeTreeData.event;

  private api = useApi();

  constructor() {
    const workspaceFolders = workspace.workspaceFolders;
    this.root = Uri.parse('positPublisherFiles://unknown');
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0].uri;
    }
  }

  public refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  getTreeItem(element: FilesTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: FilesTreeItem | undefined): Promise<FilesTreeItem[]> {
    if (element === undefined) {
      // first call. 
      try {
        const response = await this.api.files.get();
        const file = response.data;

        commands.executeCommand('setContext', isEmptyContext, Boolean(file));

        resetFileTrees();
        // skipping the top level
        file.files.forEach(f => buildFileTrees(f, this.root));
        sortFileTrees();

        // we have a fixed top hiearchy
        return [
          new FilesTreeItem(
            FileItemTreeMode.includedTitle,
            this.root,
            undefined,
            `Included Files`,
          ),
          new FilesTreeItem(
            FileItemTreeMode.excludedTitle,
            this.root,
            undefined,
            `Excluded Files`,
          ),
        ];
      } catch (error: unknown) {
        const summary = getSummaryStringFromError('files::getChildren', error);
        commands.executeCommand('setContext', isEmptyContext, true);
        window.showInformationMessage(summary);
        return [];
      }
    }
    if (element.type === FileItemTreeMode.includedTitle) {
      return includedFiles;
    } else if (element.type === FileItemTreeMode.excludedTitle) {
      return excludedFiles;
    }
    // should be flat below the actual files
    return [];
  }

  public register(context: ExtensionContext) {
    const treeView = window.createTreeView(
      viewName,
      {
        treeDataProvider: this,
      },
    );
    treeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const item = e.selection.at(0);
        commands.executeCommand(editCommand, item);
      }
    });
    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh)
    );
    context.subscriptions.push(
      commands.registerCommand(editCommand, async (item: FilesTreeItem) => {
        if (item.fileUri) {
          await commands.executeCommand('vscode.open', item.fileUri);
        }
      })
    );
    context.subscriptions.push(
      commands.registerCommand(editPositIgnoreCommand, async () => {
        if (this.root !== undefined) {
          updateNewOrExistingFile(
            path.join(this.root.fsPath, '.positignore'),
            positIgnoreFileTemplate,
            undefined, // No suffix
            true, // open file preview after update
          );
        }
      })
    );
    context.subscriptions.push(
      commands.registerCommand(addExclusionCommand, async (item: FilesTreeItem) => {
        if (this.root !== undefined) {
          updateNewOrExistingFile(
            path.join(this.root.fsPath, '.positignore'),
            positIgnoreFileTemplate,
            `${item.id}\n`,
            true, // open file preview after update
          );
        }
      })
    );

    if (this.root !== undefined) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, '**')
      );
      watcher.onDidCreate(this.refresh);
      watcher.onDidDelete(this.refresh);
      watcher.onDidChange(this.refresh);
      context.subscriptions.push(watcher);
    }
  }
}

let includedFiles: FilesTreeItem[] = [];
let excludedFiles: FilesTreeItem[] = [];

const pathToFilesTreeItemMap = new Map<string, FilesTreeItem>();

function sortFilesTreeItemByPath(a: FilesTreeItem, b: FilesTreeItem) {
  if (a.abs && b.abs) {
    return pathSorter(a.abs.split('/'), b.abs.split('/'));
  }
  return 0;
};

const sortFileTrees = () => {
  includedFiles.sort(sortFilesTreeItemByPath);
  excludedFiles.sort(sortFilesTreeItemByPath);
};

const resetFileTrees = () => {
  includedFiles = [];
  excludedFiles = [];
  pathToFilesTreeItemMap.clear();
};

const buildFileTrees = (
  file: DeploymentFile,
  root: Uri,
  exclusionOverride?: ExclusionMatch | null,
) => {
  if (file.isFile) {
    if (file.exclusion || exclusionOverride) {
      const f = new FilesTreeItem(
        FileItemTreeMode.excludedFile,
        root,
        {
          ...file,
          exclusion: file.exclusion || exclusionOverride || null,
        }
      );
      pathToFilesTreeItemMap.set(f.getUri().toString(), f);
      excludedFiles.push(f);
    } else {
      const f = new FilesTreeItem(
        FileItemTreeMode.includedFile,
        root,
        file,
      );
      pathToFilesTreeItemMap.set(f.getUri().toString(), f);
      includedFiles.push(f);
    }
  } else {
    // We're not showing our .posit subdirectory, but it will be included
    // in the deployment bundle unless they explicitly exclude it in the 
    // .positignore.
    if (file.id === '.posit') {
      return;
    }
  }

  file.files.forEach(d => {
    buildFileTrees(d, root, file.exclusion || exclusionOverride);
  });
};

export class FilesTreeItem extends TreeItem {
  public abs?: string;
  public fileUri?: Uri;
  public exclusion?: ExclusionMatch | null;

  constructor(
    public type: FileItemTreeMode,
    public root: Uri,
    public deploymentFile?: DeploymentFile,
    public labelOverride?: string,
  ) {
    super(
      labelOverride
        ? labelOverride
        : deploymentFile ? deploymentFile.base : 'Unknown'
    );
    if (
      deploymentFile &&
      (type === FileItemTreeMode.includedFile || type === FileItemTreeMode.excludedFile)
    ) {
      this.id = deploymentFile.id;
      this.label = deploymentFile.base;
      this.contextValue = deploymentFile.exclusion ? isExcludedFile : isIncludedFile;
      this.resourceUri = this.calculateUri(type);
      this.fileUri = Uri.file(path.join(this.root.fsPath, deploymentFile.id));
      this.collapsibleState = TreeItemCollapsibleState.None;
      this.exclusion = deploymentFile.exclusion;

      this.description = path.dirname(deploymentFile.id);
      if (this.description === '.') {
        this.description = undefined;
      }

      this.abs = deploymentFile.abs;
      this.iconPath = new ThemeIcon('debug-stackframe-dot');
      const fullPath = Uri.file(path.join(this.root.fsPath, deploymentFile.id));

      if (type === FileItemTreeMode.includedFile) {
        this.tooltip =
          `This file will be included in the next deployment.\n${fullPath}`;
      } else {
        this.tooltip =
          `This file will be excluded in the next deployment.\n${fullPath}\n\n`;
        if (this.exclusion) {
          if (this.exclusion.source === 'built-in') {
            this.tooltip +=
              `This is a built-in exclusion for the pattern: '${this.exclusion?.pattern}'`;
          } else {
            this.tooltip +=
              `The project's .positignore file is excluding it\nwith the pattern '${this.exclusion?.pattern}' on line #${this.exclusion?.line}`;
          }
        }
      }

    } else if (type === FileItemTreeMode.includedTitle) {
      this.contextValue = isIncludedTitle;
      this.resourceUri = this.calculateUri(type);
      this.collapsibleState = TreeItemCollapsibleState.Expanded;
      this.tooltip =
        `Files listed within this tree node will be uploaded during the next deployment.`;
      this.iconPath = new ThemeIcon('list-unordered');

    } else if (type === FileItemTreeMode.excludedTitle) {
      this.contextValue = isExcludedTitle;
      this.resourceUri = this.calculateUri(type);
      this.collapsibleState = TreeItemCollapsibleState.Expanded;
      this.tooltip =
        `Files listed within this tree node will not be uploaded during the next deployment.`;
      this.iconPath = new ThemeIcon('list-unordered');
    }
  }

  public getUri = () => {
    return this.calculateUri(this.type);
  };

  private calculateUri = (type: FileItemTreeMode) => {
    switch (type) {
      case FileItemTreeMode.includedTitle:
        return Uri.parse(`positPublisherFiles://includedTitle`);
      case FileItemTreeMode.excludedTitle:
        return Uri.parse(`positPublisherFiles://excludedTitle`);
      case FileItemTreeMode.includedFile:
        return Uri.parse(`positPublisherFilesIncluded://${this.id}`);
      case FileItemTreeMode.excludedFile:
        return Uri.parse(`positPublisherFilesExcluded://${this.id}`);
    }
  };
}
