import { isDeployment, isPreDeployment, useApi } from "src/api";
import { MultiStepState, MultiStepInput } from "src/multiStepInputs/multiStepHelper";
import { getSummaryStringFromError } from "src/utils/errors";
import { window } from "vscode";
import { CommonInputOptions } from "./commonInputHelper";
import { uniqueDeploymentName } from "src/utils/names";

export class DeploymentNameEntry {
  private api = useApi();
  private deploymentNames: string[] = [];

  constructor() {
    this.refresh();
  }

  public async refresh() {
    try {
      const response = await this.api.deployments.getAll();
      const deploymentList = response.data;
      this.deploymentNames = deploymentList.map(deployment => {
        if (isPreDeployment(deployment) || isDeployment(deployment)) {
          return deployment.saveName;
        }
        return deployment.deploymentName;
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('DeploymentNameEntry::refresh', error);
      window.showInformationMessage(
        `Unable to continue due to deployment error. ${summary}`
      );
      return;
    }
  }

  public async input(
    input: MultiStepInput,
    state: MultiStepState,
    options: CommonInputOptions,
  ) {
    state.data.deploymentName = await input.showInputBox({
      title: options.title,
      step: options.stepNumber,
      totalSteps: options.totalSteps,
      value: await this.calculateCurrentName(state),
      prompt: 'Choose a unique name for the deployment',
      validate: this.validateNameIsUnique,
      shouldResume: () => { return Promise.reject(false); },
    });
    return options.nextStep;
  }

  private async calculateCurrentName(state: MultiStepState): Promise<string> {
    if (state.data && state.data.deploymentName) {
      if (typeof state.data.deploymentName === 'string') {
        return Promise.resolve(state.data.deploymentName);
      }
    }
    // return default
    return await untitledDeploymentnName();
  }

  private validateNameIsUnique(value: string): Promise<string | undefined> {
    if (uniqueDeploymentName(value, this.deploymentNames)) {
      return Promise.resolve(undefined);
    }
    return Promise.reject('Name is not unique');
  }

}

function untitledDeploymentnName(): string | PromiseLike<string> {
  throw new Error("Function not implemented.");
}
