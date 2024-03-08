// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  FileSystemWatcher,
  RelativePattern,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  window,
  workspace,
} from 'vscode';

import { AxiosError } from 'axios';
import api from '../api';
import { isRequirementsError } from '../api/types/requirements';
import { confirmUpdate } from '../dialogs';
import { getSummaryStringFromError } from '../utils/errors';
import { fileExists } from '../utils/files';

const viewName = 'posit.publisher.requirements';
const editCommand = viewName + '.edit';
const refreshCommand = viewName + '.refresh';
const scanCommand = viewName + '.scan';
const contextIsEmpty = viewName + '.isEmpty';
const fileStore = 'requirements.txt';

type RequirementsEventEmitter = EventEmitter<RequirementsTreeItem | undefined | void>;
type RequirementsEvent = Event<RequirementsTreeItem | undefined | void>;

export class RequirementsTreeDataProvider implements TreeDataProvider<RequirementsTreeItem> {
  private root: WorkspaceFolder | undefined;
  private fileUri: Uri | undefined;
  private _onDidChangeTreeData: RequirementsEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: RequirementsEvent = this._onDidChangeTreeData.event;

  constructor() {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
      this.fileUri = Uri.joinPath(this.root.uri, fileStore);
    }
  }

  getTreeItem(element: RequirementsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: RequirementsTreeItem | undefined): Promise<RequirementsTreeItem[]> {
    if (element !== undefined) {
      // Requirements items have no children.
      return [];
    }
    if (this.root === undefined) {
      // No workspace directory is available to read the data from.
      return [];
    }
    try {
      const response = await api.requirements.getAll();
      if (isRequirementsError(response.data)) {
        throw(response.data.error);
      }
      await this.setContextIsEmpty(false);
      return response.data.requirements.map(line => new RequirementsTreeItem(line));

    } catch(error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        // No requirements file; show the welcome view.
        await this.setContextIsEmpty(true);
        return [];
      } else {
        const summary = getSummaryStringFromError('requirements::getChildren', error);
        window.showInformationMessage(summary);
        return [];
      }
    }
  }

  private async setContextIsEmpty(isEmpty: boolean): Promise<void>{
    await commands.executeCommand('setContext', contextIsEmpty, isEmpty ? "empty" : "notEmpty");
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
    if (this.root !== undefined) {
      context.subscriptions.push(
        commands.registerCommand(editCommand, this.edit),
        commands.registerCommand(refreshCommand, this.refresh),
        commands.registerCommand(scanCommand, this.scan),
        this.createFileSystemWatcher(this.root)
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
  };

  private refresh = () => {
    this._onDidChangeTreeData.fire();
  };

  private scan = async () => {
    if (this.fileUri === undefined) {
      return;
    }

    if (await fileExists(this.fileUri)) {
      const ok = await confirmUpdate('Are you sure you want to update your existing requirements.txt file?');
      if (!ok) {
        return;
      }
    }

    try {
      await api.requirements.create("requirements.txt");
      await this.edit();
    } catch(error: unknown) {
      const summary = getSummaryStringFromError('dependencies::scan', error);
      window.showInformationMessage(summary);
    }
  };

  private edit = async () => {
    if (this.fileUri !== undefined) {
      await commands.executeCommand('vscode.open', this.fileUri);
    }
  };
}

export class RequirementsTreeItem extends TreeItem {

  constructor(itemString: string) {
    super(itemString);
  }

  contextValue = 'posit.publisher.dependencies.tree.item';
}