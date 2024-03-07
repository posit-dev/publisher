// Copyright (C) 2024 by Posit Software, PBC.

import * as path from 'path';

import {
  TreeDataProvider,
  TreeItem,
  ExtensionContext,
  window,
  Event,
  EventEmitter,
  WorkspaceFolder,
  workspace,
  commands,
  TreeItemCollapsibleState,
  // TreeItemCheckboxState,
  Uri,
  FileDecorationProvider,
  ProviderResult,
  FileDecoration,
  ThemeColor,
} from 'vscode';

import {
  useApi,
} from '../api';
import { DeploymentFile, ExclusionMatch, ExclusionMatchSource } from '../api/types/files';
import { getSummaryStringFromError } from '../utils/errors';
import { convertKeysToCamelCase } from '../utils/object';

const viewName = 'posit.publisher.files';
const refreshCommand = viewName + '.refresh';
const dirContext = viewName + '.isDir';
const fileContext = viewName + '.isFile';
const isEmptyContext = viewName + '.isEmpty';

type FilesEventEmitter = EventEmitter<FilesTreeItem | undefined | void>;
type FilesEvent = Event<FilesTreeItem | undefined | void>;

const filePathToFileMap = new Map<string, DeploymentFile>();

const propigateExclusions = (deploymentFile: DeploymentFile, excluded: ExclusionMatch | null): DeploymentFile => {
  if (!deploymentFile.exclusion && excluded) {
    deploymentFile.exclusion = {
      ...excluded,
    };
  }
  deploymentFile.files.forEach(d => propigateExclusions(d, deploymentFile.exclusion));
  return deploymentFile;
};


const seedFilePathToFileMap = (deploymentFile: DeploymentFile, top = false): void => {
  console.log(JSON.stringify(deploymentFile));

  if (top) {
    filePathToFileMap.clear();
  }

  filePathToFileMap.set(deploymentFile.abs, deploymentFile);
  deploymentFile.files.forEach(d => { seedFilePathToFileMap(d, false); });
};

export class FilesTreeDataProvider implements TreeDataProvider<FilesTreeItem> {
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: FilesEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: FilesEvent = this._onDidChangeTreeData.event;

  private api = useApi();

  constructor() {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  public refresh = () => {
    console.log("refreshing files");
    this._onDidChangeTreeData.fire();
  };

  private fileToFileTreeItem = (file: DeploymentFile): FilesTreeItem => {

    let tooltip: string | undefined = undefined;
    if (file.exclusion) {
      if (file.exclusion.source === ExclusionMatchSource.BUILT_IN) {
        tooltip = `File will be xxcluded from your deployment\n\nSource: ${file.exclusion.source}`;
      } else {
        tooltip = `File will be excluded from your deployment\n\nSource: ${file.exclusion.source}\nLine #: ${file.exclusion.line}\nPattern: ${file.exclusion.pattern}\nFile Path: ${file.exclusion.filePath}`;
      }
    }

    const node: FilesTreeItem = {
      id: file.id,
      // label: file.base,
      contextValue: file.isDir ? dirContext : fileContext,
      resourceUri: this.root ? Uri.file(path.join(this.root.uri.fsPath, file.id)) : undefined,
      collapsibleState: file.isDir ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
      description: file.exclusion ? '(excluded)' : undefined,
      tooltip: tooltip,
      // checkboxState: file.exclusion ? TreeItemCheckboxState.Unchecked : TreeItemCheckboxState.Checked,
    };
    if (file.files && file.files.length) {
      node.children = file.files.map(this.fileToFileTreeItem);
      if (!file.exclusion) {
        if (file.isDir) {
          if (file.id === '.posit') {
            node.collapsibleState = TreeItemCollapsibleState.Collapsed;
          }
        }
      }
    }
    if (this.root) {
      console.log(file.id, JSON.stringify(file.exclusion));
    }
    return node;
  };

  getTreeItem(element: FilesTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: FilesTreeItem | undefined): Promise<FilesTreeItem[]> {
    const root = this.root;
    if (root === undefined) {
      // There can't be any files if we don't have a folder open.
      return [];
    }

    if (element === undefined) {
      // first call. 
      try {
        const response = await this.api.files.get();
        const rawFile = response.data;
        const file = convertKeysToCamelCase(rawFile);
        commands.executeCommand('setContext', isEmptyContext, Boolean(file));
        const fileWithDeepExclusions = propigateExclusions(file, null);
        seedFilePathToFileMap(fileWithDeepExclusions, true);
        const topTree = this.fileToFileTreeItem(fileWithDeepExclusions);

        return [topTree];
      } catch (error: unknown) {
        const summary = getSummaryStringFromError('files::getChildren', error);
        commands.executeCommand('setContext', isEmptyContext, true);
        window.showInformationMessage(summary);
        return [];
      }
    }
    return element.children ? element.children : [];
  }



  public register(context: ExtensionContext) {
    // window.registerTreeDataProvider(viewName, this);

    context.subscriptions.push(
      window.registerFileDecorationProvider(new TodoDecorationProvider())
    );

    const treeView = window.createTreeView(
      viewName,
      {
        treeDataProvider: this,
        showCollapseAll: true,
        canSelectMany: false,
        manageCheckboxStateManually: true,
      }
    )

    context.subscriptions.push(treeView);

    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh)
    );

    context.subscriptions.push(
      treeView.onDidChangeCheckboxState(async event => {

        // event = {item: Array(n)}, which TreeItem's checkbox was clicked and its state after clicking:0/1 = on/off

        console.log(event);
      })
    );
  }
}

class TodoDecorationProvider implements FileDecorationProvider {
  provideFileDecoration(uri: Uri): ProviderResult<FileDecoration> {

    // https://code.visualstudio.com/api/references/theme-color#lists-and-trees
    // console.log(uri);
    const deploymentFile = filePathToFileMap.get(uri.fsPath);

    if (deploymentFile) {
      if (deploymentFile.exclusion) {
        return {
          color: new ThemeColor('disabledForeground'),
          badge: '!',
          propagate: true,
        };
      }
    }

    return {
      color: new ThemeColor('foreground'),
      propagate: true,
    };;
  }
}

export class FilesTreeItem extends TreeItem {
  public children?: FilesTreeItem[];

  constructor(itemString: string) {
    super(itemString);
    // this is important, otherwise provideFileDecoration will not be called
    // this.resourceUri = Uri.parse('foo://bar');
  }
}
