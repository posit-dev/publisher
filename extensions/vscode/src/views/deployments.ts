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
  isDeploymentError,
  PreDeployment,
  isPreDeployment,
} from '../api';

import { getSummaryStringFromError } from '../utils/errors';
import { formatDateString } from '../utils/date';

type DeploymentMap = Record<string, Deployment | PreDeployment | DeploymentError>;

const viewName = 'posit.publisher.deployments';

export class DeploymentsTreeDataProvider implements TreeDataProvider<DeploymentsTreeItem> {

  private deploymentMap: DeploymentMap = {};
  private api = useApi();

  constructor() { }

  getTreeItem(element: DeploymentsTreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }
  async getChildren(element: DeploymentsTreeItem | undefined): Promise<DeploymentsTreeItem[]> {
    if (element === undefined) {
      if (Object.keys(this.deploymentMap).length === 0) {
        await this.refreshDeployments();
      }
      return this.convertDeploymentsToTreeList();
    }
    return [];
  }

  public register(context: ExtensionContext) {
    window.registerTreeDataProvider(viewName, this);
    context.subscriptions.push(
      window.createTreeView(viewName, { treeDataProvider: this })
    );
  }

  private async refreshDeployments() {
    try {
      this.deploymentMap = {};

      // API Returns:
      // 200 - success
      // 500 - internal server error
      const response = (await this.api.deployments.getAll()).data;
      response.forEach((deployment) => {
        if (isDeploymentError(deployment)) {
          this.deploymentMap[deployment.deploymentName] = deployment;
        } else {
          this.deploymentMap[deployment.saveName] = deployment;
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('deployments::refreshDeployments', error);
      window.showInformationMessage(summary);
    }
  };

  private convertDeploymentsToTreeList(): DeploymentsTreeItem[] {
    return Object.keys(this.deploymentMap).map(key => {
      const deployment = this.deploymentMap[key];
      return new DeploymentsTreeItem(deployment);
    });
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
      `Last Deployed: ${formatDateString(deployment.deployedAt)}\n` +
      `To: ${deployment.serverType} at ${deployment.serverUrl}\n` +
      `GUID: ${deployment.id}`;
  }

  private initializePreDeployment(predeployment: PreDeployment) {
    this.contextValue = 'posit.publisher.deployments.tree.item.predeployment';
    this.tooltip =
      `${predeployment.deploymentName}\n` +
      `Created: ${formatDateString(predeployment.createdAt)}\n` +
      `To: ${predeployment.serverType} at ${predeployment.serverUrl}\n` +
      `Not Yet Deployed`;
  }

  private initializeDeploymentError(deploymentError: DeploymentError) {
    this.contextValue = 'posit.publisher.deployments.tree.item.deploymentError';
    this.tooltip =
      `${deploymentError.deploymentName}\n` +
      `ERROR: File is invalid\n` +
      `Details: ${deploymentError.error}`;
  }
}
