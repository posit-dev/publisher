import { MultiStepInput, MultiStepState, isQuickPickItem } from './multiStepHelper';

import { QuickPickItem, ThemeIcon, window } from 'vscode';

import { AccountAuthType, PreDeployment, Deployment, useApi } from '../api';
import { getSummaryStringFromError } from '../utils/errors';

// Was offering parameter (context: ExtensionContext)
export async function publishDeployment(deployment: PreDeployment | Deployment) {
  const api = useApi();

  const title = 'Deploy Your Project';

  let accountListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];

  try {
    const response = await api.accounts.getAll();
    const accounts = response.data.accounts;
    accountListItems = accounts
      .filter(account => (account.url === deployment.serverUrl))
      .map(account => ({
        iconPath: new ThemeIcon('account'),
        label: account.name,
        description: account.source,
        detail: account.authType === AccountAuthType.API_KEY
          ? 'Using API Key'
          : `Using Token Auth for ${account.accountName}`,
      }));
  } catch (error: unknown) {
    const summary = getSummaryStringFromError('publishDeployment, accounts.getAll', error);
    window.showInformationMessage(
      `Unable to continue with no credentials. ${summary}`
    );
    return;
  }
  if (accountListItems.length === 0) {
    window.showInformationMessage(
      `Unable to continue with no maching credentials for deployment URL: ${deployment.serverUrl}`
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
    const summary = getSummaryStringFromError('publishDeployment, configurations.getAll', error);
    window.showInformationMessage(
      `Unable to continue with no configurations. ${summary}`
    );
    return;
  }

  // Select the credential to use, if there is more than one
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
    await MultiStepInput.run(input => pickCredentials(input, state));
    return state as MultiStepState;
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
      step: 1,
      totalSteps: 2,
      placeholder: 'Select the credential you want to use to deploy',
      items: accountListItems,
      activeItem: typeof state.data.credentialName !== 'string' ? state.data.credentialName : undefined,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
    });
    state.data.credentialName = pick;
    return (input: MultiStepInput) => inputConfigFileSelection(input, state);
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
      step: 2,
      totalSteps: 2,
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
    isQuickPickItem(state.data.credentialName) &&
    isQuickPickItem(state.data.configFile)
  ) {
    // deploy!
    try {
      const response = await api.deployments.publish(
        deployment.saveName,
        state.data.credentialName.label,
        state.data.configFile.label,
      );
      window.showInformationMessage(
        `deploy the deployment file ${state.data.deploymentName}, using credentials ${state.data.credentialName.label}
        and config file: ${state.data.configFile.label}. LocalID = ${response.data.localId}`
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError('publishDeployment, deploy', error);
      window.showInformationMessage(
        `Failed to deploy . ${summary}`
      );
      return;
    }
  }
}
