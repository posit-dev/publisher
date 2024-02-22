import {
  TreeDataProvider,
  TreeItem,
  ExtensionContext,
  window,
} from 'vscode';

import {
  useApi,
  Deployment,
  DeploymentError,
  isDeployment,
  PreDeployment,
  isPreDeployment,
} from '../api';

import { getSummaryStringFromError } from '../utils/errors';
import { formatDateString } from '../utils/date';

const viewName = 'posit.publisher.deployments';

export class DeploymentsTreeDataProvider implements TreeDataProvider<DeploymentsTreeItem> {

  private api = useApi();

  constructor() { }

  getTreeItem(element: DeploymentsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }
  async getChildren(element: DeploymentsTreeItem | undefined): Promise<DeploymentsTreeItem[]> {
    if (element) {
      // flat organization of deployments, so no children.
      return [];
    }
    try {
      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = (await this.api.deployments.getAll());
      return response.data.map(deployment => {
        return new DeploymentsTreeItem(deployment);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('deployments::getChildren', error);
      window.showInformationMessage(summary);
      return [];
    }
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
  }
}

export class DeploymentsTreeItem extends TreeItem {
  private deployment: Deployment | PreDeployment | DeploymentError;

  constructor(deployment: Deployment | PreDeployment | DeploymentError) {
    super(deployment.deploymentName);
    this.deployment = deployment;
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
  }

  private initializePreDeployment(predeployment: PreDeployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.predeployment';
    this.tooltip =
      `${predeployment.deploymentName}\n` +
      `Created on ${formatDateString(predeployment.createdAt)}\n` +
      `Targeting ${predeployment.serverType} at ${predeployment.serverUrl}\n` +
      `WARNING! Not Yet Deployed`;
  }

  private initializeDeploymentError(deploymentError: DeploymentError) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deploymentError';
    this.tooltip =
      `${deploymentError.deploymentName}\n` +
      `ERROR! File is invalid\n` +
      `Details: ${deploymentError.error}`;
  }
}
