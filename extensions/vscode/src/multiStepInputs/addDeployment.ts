import { MultiStepInput, MultiStepState, isQuickPickItem } from './multiStepHelper';

import { QuickPickItem, ThemeIcon, window } from 'vscode';

import { AccountAuthType, useApi } from '../api';
import { getSummaryStringFromError } from '../utils/errors';
import { uniqueDeploymentName, untitledDeploymentName } from '../utils/names';
import { initiatePublishing } from '../views/publishProgress';
import { EventStream } from '../events';

export async function addDeployment(stream: EventStream) {
  const api = useApi();

  const title = 'Deploy Your Project to a New Location';

  let accountListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];
  let deploymentNames: string[] = [];

  try {
    const response = await api.accounts.getAll();
    const accounts = response.data.accounts;
    accountListItems = accounts.map(account => ({
      iconPath: new ThemeIcon('account'),
      label: account.name,
      description: account.source,
      detail: account.authType === AccountAuthType.API_KEY
        ? 'Using API Key'
        : `Using Token Auth for ${account.accountName}`,
    }));
  } catch (error: unknown) {
    const summary = getSummaryStringFromError('addDeployment, accounts.getAll', error);
    window.showInformationMessage(
      `Unable to continue with no credentials. ${summary}`
    );
    return;
  }

  try {
    const response = await api.configurations.getAll();
    const configurations = response.data;
    configFileListItems = configurations.map(configuration => ({
      iconPath: new ThemeIcon('file-code'),
      label: configuration.configurationName,
      detail: configuration.configurationPath,
    }));
  } catch (error: unknown) {
    const summary = getSummaryStringFromError('addDeployment, configurations.getAll', error);
    window.showInformationMessage(
      `Unable to continue with no configurations. ${summary}`
    );
    return;
  }

  try {
    const response = await api.deployments.getAll();
    const deploymentList = response.data;
    deploymentNames = deploymentList.map(deployment =>
      deployment.deploymentPath.split('.posit/publish/deployments/')[1].slice(0, -5)
    );
  } catch (error: unknown) {
    const summary = getSummaryStringFromError('addDeployment, deployments.getAll', error);
    window.showInformationMessage(
      `Unable to continue due to deployment error. ${summary}`
    );
    return;
  }

  // Name the deployment
  // Select the credential to use, if there is more than one
  // Prompt to deploy
  // Select the config file to use, if there are more than one
  // result in calling publish API

  async function collectInputs() {
    const state = {} as Partial<MultiStepState>;
    state.data = {
      deploymentName: '',
      credentialName: <QuickPickItem>{},
      promptToDeploy: '',
      configFile: <QuickPickItem>{},
    };
    await MultiStepInput.run(input => inputDeploymentName(input, state));
    return state as MultiStepState;
  }

  async function inputDeploymentName(input: MultiStepInput, state: Partial<MultiStepState>) {
    if (state.data === undefined) {
      state.data = {
        deploymentName: '',
        credentialName: <QuickPickItem>{},
        promptToDeploy: '',
        configFile: <QuickPickItem>{},
      };
    }
    state.data.deploymentName = await input.showInputBox({
      title,
      step: 1,
      totalSteps: 4,
      value: typeof state.data.deploymentName === 'string' && state.data.deploymentName.length
        ? state.data.deploymentName
        : untitledDeploymentName(deploymentNames),
      prompt: 'Choose a unique name for the deployment',
      validate: (value) => {
        if (value.length < 3 || !uniqueDeploymentName(value, deploymentNames)) {
          return Promise.resolve('Must be unique and have a length greater than 3');
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
    });
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  async function pickCredentials(input: MultiStepInput, state: Partial<MultiStepState>) {
    if (state.data === undefined) {
      state.data = {
        deploymentName: '',
        credentialName: <QuickPickItem>{},
        promptToDeploy: '',
        configFile: <QuickPickItem>{},
      };
    }
    const pick = await input.showQuickPick({
      title,
      step: 2,
      totalSteps: 4,
      placeholder: 'Select the credential you want to use to deploy',
      items: accountListItems,
      activeItem: typeof state.data.credentialName !== 'string' ? state.data.credentialName : undefined,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
    });
    state.data.credentialName = pick;
    return (input: MultiStepInput) => promptToDeploy(input, state);
  }

  async function promptToDeploy(input: MultiStepInput, state: Partial<MultiStepState>) {
    if (state.data === undefined) {
      state.data = {
        deploymentName: '',
        credentialName: <QuickPickItem>{},
        promptToDeploy: '',
        configFile: <QuickPickItem>{},
      };
    }
    const pick = await input.showQuickPick({
      title,
      step: 3,
      totalSteps: 4,
      placeholder: 'Do you wish to initiate the deployment at this time?',
      items: [
        {
          label: 'Yes',
          description: 'Proceed with deployment'
        },
        {
          label: 'No',
          description: 'Just save my deployment for use at a later time',
        }
      ],
      activeItem: typeof state.data.promptToDeploy !== 'string' ? state.data.promptToDeploy : undefined,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
    });
    state.data.promptToDeploy = pick;
    if (state.data.promptToDeploy.label === 'Yes') {
      return (input: MultiStepInput) => inputConfigFileSelection(input, state);
    }
    return undefined;
  }

  async function inputConfigFileSelection(input: MultiStepInput, state: Partial<MultiStepState>) {
    if (state.data === undefined) {
      state.data = {
        deploymentName: '',
        credentialName: <QuickPickItem>{},
        promptToDeploy: '',
        configFile: <QuickPickItem>{},
      };
    }
    const pick = await input.showQuickPick({
      title,
      step: 4,
      totalSteps: 4,
      placeholder: 'Select the config file you wish to deploy with',
      items: configFileListItems,
      activeItem: typeof state.data.configFile !== 'string' ? state.data.configFile : undefined,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
    });
    state.data.configFile = pick;
  }

  const state = await collectInputs();
  // Need to determine what we get back when the user
  // hits escape
  if (
    !isQuickPickItem(state.data.deploymentName) && state.data.deploymentName.length > 0 &&
    isQuickPickItem(state.data.credentialName) &&
    isQuickPickItem(state.data.promptToDeploy)
  ) {
    // we might have enough to at least create the predeployment
    if (state.data.deploymentName.length > 0) {
      // we can!
      try {
        await api.deployments.createNew(
          state.data.credentialName.label,
          state.data.deploymentName,
        );
      } catch (error: unknown) {
        const summary = getSummaryStringFromError('addDeployment, createNew', error);
        window.showInformationMessage(
          `Failed to create pre-deployment. ${summary}`
        );
        return;
      }
      if (isQuickPickItem(state.data.configFile)) {
        // we may be able to deploy
        if (state.data.promptToDeploy.label === 'Yes') {
          // we can!
          try {
            const response = await api.deployments.publish(
              state.data.deploymentName,
              state.data.credentialName.label,
              state.data.configFile.label,
            );
            initiatePublishing(response.data.localId, stream);
          } catch (error: unknown) {
            const summary = getSummaryStringFromError('addDeployment, deploy', error);
            window.showInformationMessage(
              `Failed to deploy . ${summary}`
            );
            return;
          }
        } else {
          // no, they didn't want us to.
          window.showInformationMessage(
            `Skipping deployment`
          );
        }
      }
    }
  }
}


