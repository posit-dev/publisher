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
} from "vscode";

import {
  AllDeploymentTypes,
  Deployment,
  DeploymentError,
  PreDeployment,
  isDeployment,
  isPreDeployment,
  isPreDeploymentWithConfig,
  useApi,
} from "src/api";

import { confirmForget } from "src/dialogs";
import { formatDateString } from "src/utils/date";
import { getSummaryStringFromError } from "src/utils/errors";
import { ensureSuffix } from "src/utils/files";
import { deploymentNameValidator } from "src/utils/names";

const viewName = "posit.publisher.deployments";
const refreshCommand = viewName + ".refresh";
const editCommand = viewName + ".edit";
const renameCommand = viewName + ".rename";
const forgetCommand = viewName + ".forget";
const visitCommand = viewName + ".visit";

const fileStore = ".posit/publish/deployments/*.toml";

type DeploymentsEventEmitter = EventEmitter<
  DeploymentsTreeItem | undefined | void
>;
type DeploymentsEvent = Event<DeploymentsTreeItem | undefined | void>;

export class DeploymentsTreeDataProvider
  implements TreeDataProvider<DeploymentsTreeItem>
{
  private root: WorkspaceFolder | undefined;
  private _onDidChangeTreeData: DeploymentsEventEmitter = new EventEmitter();
  readonly onDidChangeTreeData: DeploymentsEvent =
    this._onDidChangeTreeData.event;

  constructor(private readonly _context: ExtensionContext) {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders !== undefined) {
      this.root = workspaceFolders[0];
    }
  }

  public refresh = () => {
    console.debug("refreshing deployments");
    this._onDidChangeTreeData.fire();
  };

  getTreeItem(element: DeploymentsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(
    element: DeploymentsTreeItem | undefined,
  ): Promise<DeploymentsTreeItem[]> {
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
      const api = await useApi();
      const response = await api.deployments.getAll();
      const deployments = response.data;

      return deployments.map((deployment) => {
        const fileUri = Uri.file(deployment.deploymentPath);
        return new DeploymentsTreeItem(deployment, fileUri);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "deployments::getChildren",
        error,
      );
      window.showInformationMessage(summary);
      return [];
    }
  }

  public register() {
    const treeView = window.createTreeView(viewName, {
      treeDataProvider: this,
    });
    this._context.subscriptions.push(treeView);

    this._context.subscriptions.push(
      commands.registerCommand(refreshCommand, this.refresh),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        forgetCommand,
        async (item: DeploymentsTreeItem) => {
          const ok = await confirmForget(
            `Are you sure you want to forget this deployment '${item.deployment.deploymentName}' locally?`,
          );
          if (ok) {
            const api = await useApi();
            await api.deployments.delete(item.deployment.deploymentName);
          }
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        editCommand,
        async (item: DeploymentsTreeItem) => {
          await commands.executeCommand("vscode.open", item.fileUri);
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        visitCommand,
        async (item: DeploymentsTreeItem) => {
          // This command is only registered for Deployments
          if (isDeployment(item.deployment)) {
            const uri = Uri.parse(item.deployment.dashboardUrl, true);
            await env.openExternal(uri);
          }
        },
      ),
    );

    this._context.subscriptions.push(
      commands.registerCommand(
        renameCommand,
        async (item: DeploymentsTreeItem) => {
          let deploymentNames: string[] = [];

          try {
            const api = await useApi();
            const response = await api.deployments.getAll();
            const deploymentList = response.data;
            // Note.. we want all of the deployment filenames regardless if they are valid or not.
            deploymentNames = deploymentList.map(
              (deployment) => deployment.deploymentName,
            );
          } catch (error: unknown) {
            const summary = getSummaryStringFromError(
              "renameDeployment, deployments.getAll",
              error,
            );
            window.showInformationMessage(
              `Unable to continue due to deployment error. ${summary}`,
            );
            return;
          }

          const currentName = item.deployment.deploymentName;
          const newName = await window.showInputBox({
            prompt: "New deployment name",
            value: currentName,
            validateInput: deploymentNameValidator(
              deploymentNames,
              currentName,
            ),
          });
          if (newName === undefined || newName === "") {
            // canceled
            return;
          }
          const oldUri = Uri.file(item.deployment.deploymentPath);
          const relativePath = "../" + ensureSuffix(".toml", newName);
          const newUri = Uri.joinPath(oldUri, relativePath);
          await workspace.fs.rename(oldUri, newUri, { overwrite: true });
        },
      ),
    );

    if (this.root !== undefined) {
      const positDirWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, ".posit"),
        true,
        true,
        false,
      );
      positDirWatcher.onDidDelete(this.refresh, this);
      const publishDirWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, ".posit/publish"),
        true,
        true,
        false,
      );
      publishDirWatcher.onDidDelete(this.refresh, this);
      const deploymentsDirWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, ".posit/publish/deployments"),
        true,
        true,
        false,
      );
      deploymentsDirWatcher.onDidDelete(this.refresh, this);

      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(this.root, fileStore),
      );
      watcher.onDidCreate(this.refresh);
      watcher.onDidDelete(this.refresh);
      watcher.onDidChange(this.refresh);

      this._context.subscriptions.push(
        positDirWatcher,
        publishDirWatcher,
        deploymentsDirWatcher,
        watcher,
      );
    }
  }
}

export class DeploymentsTreeItem extends TreeItem {
  constructor(
    public deployment: AllDeploymentTypes,
    public readonly fileUri: Uri,
  ) {
    super(deployment.deploymentName);

    if (isDeployment(this.deployment)) {
      this.initializeDeployment(this.deployment);
    } else if (
      isPreDeployment(this.deployment) ||
      isPreDeploymentWithConfig(this.deployment)
    ) {
      this.initializePreDeployment(this.deployment);
    } else {
      this.initializeDeploymentError(this.deployment);
    }
    this.command = {
      title: "Open",
      command: "vscode.open",
      arguments: [this.fileUri],
    };
  }

  private initializeDeployment(deployment: Deployment) {
    this.contextValue = "posit.publisher.deployments.tree.item.deployment";
    if (!deployment.deploymentError) {
      this.tooltip =
        `Deployment file: ${deployment.deploymentPath}\n` +
        `\n` +
        `Last Deployed on ${formatDateString(deployment.deployedAt)}\n` +
        `Targeting ${deployment.serverType} at ${deployment.serverUrl}\n` +
        `GUID = ${deployment.id}`;
      this.iconPath = new ThemeIcon("cloud-upload");
    } else {
      this.tooltip =
        `Deployment file: ${deployment.deploymentPath}\n` +
        `\n` +
        `Last deployment failed on ${formatDateString(deployment.deployedAt)}\n` +
        `Targeting ${deployment.serverType} at ${deployment.serverUrl}`;
      // deployment id may not yet be assigned...
      if (deployment.id) {
        this.tooltip += `\n` + `GUID = ${deployment.id}`;
      }
      this.tooltip += "\n" + `\n` + `Error: ${deployment.deploymentError.msg}`;
      this.iconPath = new ThemeIcon("run-errors");
    }
  }

  private initializePreDeployment(predeployment: PreDeployment) {
    this.contextValue = "posit.publisher.deployments.tree.item.predeployment";
    this.tooltip =
      `Deployment file: ${predeployment.deploymentPath}\n` +
      `\n` +
      `Created on ${formatDateString(predeployment.createdAt)}\n` +
      `Targeting ${predeployment.serverType} at ${predeployment.serverUrl}\n` +
      `\n` +
      `Warning! Not yet deployed to the server`;
    this.iconPath = new ThemeIcon("ellipsis");
  }

  private initializeDeploymentError(deploymentError: DeploymentError) {
    this.contextValue = "posit.publisher.deployments.tree.item.deploymentError";
    this.tooltip =
      `Deployment file: ${deploymentError.deploymentPath}\n` +
      `\n` +
      `ERROR! File is invalid\n` +
      `Code: ${deploymentError.error.code}\n` +
      `Msg: ${deploymentError.error.msg}\n` +
      `\n` +
      `Warning: This deployment cannot be deployed\n` +
      `until the issue is resolved.`;

    this.iconPath = new ThemeIcon("warning");
  }
}
