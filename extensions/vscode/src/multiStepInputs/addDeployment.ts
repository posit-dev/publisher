import { MultiStepInput, MultiStepState } from './multiStepHelper';

import { QuickPickItem, ThemeIcon, window } from 'vscode';

import { AccountAuthType, useApi } from '../api';
import { getSummaryStringFromError } from '../utils/errors';

// Was offering parameter (context: ExtensionContext)
export async function addDeployment() {
  const api = useApi();

  const title = 'Create Deployment';

  let accountListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];
  // let deploymentNames: string[] = [];

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

  // try {
  //   const response = await api.deployments.getAll();
  //   const deploymentList = response.data;
  //   deploymentNames = deploymentList.map(deployment =>
  //     deployment.deploymentPath.split('.posit/publish/deployments/')[1]
  //   );
  // } catch (error: unknown) {
  //   const summary = getSummaryStringFromError('addDeployment, deployments.getAll', error);
  //   window.showInformationMessage(
  //     `Unable to continue due to deployment error. ${summary}`
  //   );
  //   return;
  // }

  // Name the deployment
  // Select the credential to use, if there is more than one
  // Prompt to deploy
  // Select the config file to use, if there are more than one
  // result in calling publish API

  // const resourceGroups: QuickPickItem[] = ['vscode-data-function', 'vscode-appservice-microservices', 'vscode-appservice-monitor', 'vscode-appservice-preview', 'vscode-appservice-prod']
  //   .map(label => ({
  //     label,
  //     iconPath: new ThemeIcon('globe'),
  //     description: 'smaller stuff',
  //     detail: 'this is a bigger description',
  //   }));

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
      value: typeof state.data.deploymentName === 'string' ? state.data.deploymentName : '',
      prompt: 'Choose a unique name for the deployment',
      validate: () => Promise.resolve(undefined),
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
      }
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
      }
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
  if (
    typeof state.data.promptToDeploy !== 'string' &&
    typeof state.data.credentialName !== 'string' &&
    typeof state.data.configFile !== 'string'
  ) {
    if (state.data.promptToDeploy.label === 'No') {
      window.showInformationMessage(
        `Ready to create pre-deployment file ${state.data.deploymentName} only`
      );
    } else {
      window.showInformationMessage(
        `Ready to deploy the deployment file ${state.data.deploymentName}, using credentials ${state.data.credentialName.label}
        and config file: ${state.data.configFile.label}`
      );
    }
  } else {
    window.showInformationMessage(`something didn't work!`);
  }
}


