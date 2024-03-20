// Copyright (C) 2024 by Posit Software, PBC.

import {
  Event,
  EventEmitter,
  ExtensionContext,
  RelativePattern,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  Uri,
  WorkspaceFolder,
  commands,
  env,
  window,
  workspace,
} from 'vscode';

import {
  AllDeploymentTypes,
  Deployment,
  DeploymentError,
  PreDeployment,
  isDeployment,
  isDeploymentError,
  isPreDeployment,
  useApi,
} from '../api';

import { confirmForget } from '../dialogs';
import { EventStream } from '../events';
import { addDeployment } from '../multiStepInputs/addDeployment';
import { publishDeployment } from '../multiStepInputs/deployProject';
import { formatDateString } from '../utils/date';
import { getSummaryStringFromError } from '../utils/errors';

const viewName = 'posit.publisher.deployments';
const refreshCommand = viewName + '.refresh';
const editCommand = viewName + '.edit';
const forgetCommand = viewName + '.forget';
const visitCommand = viewName + '.visit';
const addCommand = viewName + '.add';
const deployCommand = viewName + '.deploy';
const isEmptyContext = viewName + '.isEmpty';

const fileStore = '.posit/publish/deployments/*.toml';

type DeploymentsEventEmitter = EventEmitter<DeploymentsTreeItem | undefined | void>;
type DeploymentsEvent = Event<DeploymentsTreeItem | undefined | void>;

export class DeploymentsTreeDataProvider implements TreeDataProvider<DeploymentsTreeItem> {
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: DeploymentsEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: DeploymentsEvent = this._onDidChangeTreeData.event;

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
        const fileUri = Uri.file(deployment.deploymentPath);
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
      }),
      commands.registerCommand(visitCommand, async (item: DeploymentsTreeItem) => {
        // This command is only registered for Deployments
        if (isDeployment(item.deployment)) {
          const uri = Uri.parse(item.deployment.dashboardUrl, true);
          await env.openExternal(uri);
        }
      })
    );


    if (this.root !== undefined) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, fileStore)
      );
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
    this.command = {
      title: 'Open',
      command: 'vscode.open',
      arguments: [this.fileUri]
    };
  }

  private initializeDeployment(deployment: Deployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deployment';
    if (!deployment.deploymentError) {
      this.tooltip =
        `Deployment file: ${deployment.deploymentPath}\n` +
        `\n` +
        `Last Deployed on ${formatDateString(deployment.deployedAt)}\n` +
        `Targeting ${deployment.serverType} at ${deployment.serverUrl}\n` +
        `GUID = ${deployment.id}`;
      this.iconPath = new ThemeIcon('cloud-upload');
    } else {
      this.tooltip =
        `Deployment file: ${deployment.deploymentPath}\n` +
        `\n` +
        `Last deployment failed on ${formatDateString(deployment.deployedAt)}\n` +
        `Targeting ${deployment.serverType} at ${deployment.serverUrl}\n` +
        `GUID = ${deployment.id}\n` +
        `\n` +
        `Error: ${deployment.deploymentError.msg}`;
      this.iconPath = new ThemeIcon('run-errors');
    }
  }

  private initializePreDeployment(predeployment: PreDeployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.predeployment';
    this.tooltip =
      `Deployment file: ${predeployment.deploymentPath}\n` +
      `\n` +
      `Created on ${formatDateString(predeployment.createdAt)}\n` +
      `Targeting ${predeployment.serverType} at ${predeployment.serverUrl}\n` +
      `\n` +
      `Warning! This deployment has not yet been deployed.`;
    this.iconPath = new ThemeIcon('ellipsis');
  }

  private initializeDeploymentError(deploymentError: DeploymentError) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deploymentError';
    this.tooltip =
      `Deployment file: ${deploymentError.deploymentPath}\n` +
      `\n` +
      `ERROR! File is invalid\n` +
      `Code: ${deploymentError.error.code}\n` +
      `Msg: ${deploymentError.error.msg}\n` +
      `\n` +
      `Warning: This deployment cannot be deployed\n` +
      `until the issue is resolved.`;

    ;
    this.iconPath = new ThemeIcon('warning');
  }
}
