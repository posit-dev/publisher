// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  TreeDataProvider,
  TreeItem,
  ExtensionContext,
  window,
  WorkspaceFolder,
  EventEmitter,
  workspace,
  RelativePattern,
  ThemeIcon,
  commands,
  Uri,
} from 'vscode';

import {
  useApi,
  Deployment,
  DeploymentError,
  isDeployment,
  PreDeployment,
  isPreDeployment,
  AllDeploymentTypes,
  isDeploymentError,
} from '../api';

import { getSummaryStringFromError } from '../utils/errors';
import { formatDateString } from '../utils/date';
import { confirmForget } from '../dialogs';
import { addDeployment } from '../multiStepInputs/addDeployment';
import { publishDeployment } from '../multiStepInputs/publishDeployment';
import { EventStream } from '../events';

const viewName = 'posit.publisher.deployments';
const refreshCommand = viewName + '.refresh';
const editCommand = viewName + '.edit';
const forgetCommand = viewName + '.forget';
const addCommand = viewName + '.add';
const deployCommand = viewName + '.deploy';
const isEmptyContext = viewName + '.isEmpty';

const fileStore = '.posit/publish/deployments/*.toml';

type ConfigurationEventEmitter = EventEmitter<DeploymentsTreeItem | undefined | void>;
type ConfigurationEvent = Event<DeploymentsTreeItem | undefined | void>;

export class DeploymentsTreeDataProvider implements TreeDataProvider<DeploymentsTreeItem> {
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: ConfigurationEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: ConfigurationEvent = this._onDidChangeTreeData.event;

  private api = useApi();

  constructor(
    private stream: EventStream
  ) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  public refresh = () => {
    console.log("refreshing deployments");
    this._onDidChangeTreeData.fire();
  };

  getTreeItem(element: DeploymentsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element: DeploymentsTreeItem | undefined): Promise<DeploymentsTreeItem[]> {
    if (element) {
      // flat organization of deployments, so no children.
      return [];
    }
    const root = this.root;
    if (root === undefined) {
      // There can't be any deployments if we don't have a folder open.
      return [];
    }

    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = await this.api.deployments.getAll();
      const deployments = response.data;
      commands.executeCommand('setContext', isEmptyContext, deployments.length === 0);

      return deployments.map(deployment => {
        const filename = deployment.deploymentPath.split('.posit/publish/deployments/')[1];
        const fileUri = Uri.joinPath(root.uri, '.posit/publish/deployments', filename);
        return new DeploymentsTreeItem(deployment, fileUri);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('deployments::getChildren', error);
      commands.executeCommand('setContext', isEmptyContext, true);
      window.showInformationMessage(summary);
      return [];
    }
  }

  public register(context: ExtensionContext) {
    const treeView = window.createTreeView(viewName, { treeDataProvider: this });
    treeView.onDidChangeSelection(e => {
      console.log(e);
      if (e.selection.length > 0) {
        const item = e.selection.at(0);
        commands.executeCommand(editCommand, item);
      }
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(
      commands.registerCommand(addCommand, () => {
        addDeployment(this.stream);
      })
    );

    context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh)
    );

    context.subscriptions.push(
      commands.registerCommand(editCommand, async (item: DeploymentsTreeItem) => {
        await commands.executeCommand('vscode.open', item.fileUri);
      })
    );

    context.subscriptions.push(
      commands.registerCommand(deployCommand, async (item: DeploymentsTreeItem) => {
        if (!isDeploymentError(item.deployment)) {
          publishDeployment(item.deployment, this.stream);
        }
      })
    );

    context.subscriptions.push(
      commands.registerCommand(forgetCommand, async (item: DeploymentsTreeItem) => {
        const ok = await confirmForget(`Are you sure you want to forget this deployment '${item.deployment.deploymentName}' locally?`);
        if (ok) {
          await this.api.deployments.delete(item.deployment.deploymentName);
        }
      })
    );

    if (this.root !== undefined) {
      console.log("creating filesystem watcher for deployment view");
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, fileStore));
      watcher.onDidCreate(this.refresh);
      watcher.onDidDelete(this.refresh);
      watcher.onDidChange(this.refresh);
      context.subscriptions.push(watcher);
    }
  }
}

export class DeploymentsTreeItem extends TreeItem {
  constructor(
    public deployment: AllDeploymentTypes,
    public readonly fileUri: Uri
  ) {
    super(deployment.deploymentName);

    if (isDeployment(this.deployment)) {
      this.initializeDeployment(this.deployment);
    } else if (isPreDeployment(this.deployment)) {
      this.initializePreDeployment(this.deployment);
    } else {
      this.initializeDeploymentError(this.deployment);
    }
  }

  private initializeDeployment(deployment: Deployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deployment';
    this.tooltip =
      `${deployment.deploymentName}\n` +
      `Last Deployed on ${formatDateString(deployment.deployedAt)}\n` +
      `Targeting ${deployment.serverType} at ${deployment.serverUrl}\n` +
      `GUID = ${deployment.id}`;
    this.iconPath = new ThemeIcon('refresh');
  }

  private initializePreDeployment(predeployment: PreDeployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.predeployment';
    this.tooltip =
      `${predeployment.deploymentName}\n` +
      `Created on ${formatDateString(predeployment.createdAt)}\n` +
      `Targeting ${predeployment.serverType} at ${predeployment.serverUrl}\n` +
      `WARNING! Not Yet Deployed`;
    this.iconPath = new ThemeIcon('cloud-upload');
  }

  private initializeDeploymentError(deploymentError: DeploymentError) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deploymentError';
    this.tooltip =
      `${deploymentError.deploymentName}\n` +
      `ERROR! File is invalid\n` +
      `Code: ${deploymentError.error.code}\n` +
      `Msg: ${deploymentError.error.msg}`;
    this.iconPath = new ThemeIcon('warning');
  }
}

