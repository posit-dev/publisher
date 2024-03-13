// Copyright (C) 2024 by Posit Software, PBC.

import { MultiStepInput, MultiStepState, isQuickPickItem } from './multiStepHelper';

import { InputBoxValidationSeverity, QuickPickItem, ThemeIcon, window } from 'vscode';

import { AccountAuthType, useApi } from '../api';
import { getSummaryStringFromError } from '../utils/errors';
import { uniqueDeploymentName, untitledDeploymentName } from '../utils/names';
import { deployProject } from '../views/deployProgress';
import { EventStream } from '../events';
import { isValidFilename } from '../utils/files';

export async function addDeployment(stream: EventStream) {
  const api = useApi();

  // ***************************************************************
  // API Calls and results
  // ***************************************************************

  let accountListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];
  let deploymentNames: string[] = [];

  try {
    const response = await api.accounts.getAll();
    const accounts = response.data.accounts;
    accountListItems = accounts
      .map(account => ({
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

  // ***************************************************************
  // Order of all steps
  // ***************************************************************

  // Name the deployment
  // Select the credential to use, if there is more than one
  // Prompt to deploy
  // Select the config file to use, if there are more than one
  // result in calling publish API

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: 'Deploy Your Project to a New Location',
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        deploymentName: undefined, // eventual type is string
        credentialName: undefined, // eventual type is QuickPickItem
        promptToDeploy: undefined, /// eventual type is QuickPickItem
        configFile: undefined, // eventual type is QuickPickItem
      },
    };
    // determin number of total steps, as each step
    // will suppress its choice if there is only one option
    let totalSteps = 4;
    if (accountListItems.length === 1) {
      totalSteps -= 1;
    }
    if (configFileListItems.length === 1) {
      totalSteps -= 1;
    }
    state.totalSteps = totalSteps;

    // start the progression through the steps

    await MultiStepInput.run(input => inputDeploymentName(input, state));
    return state as MultiStepState;
  }



  // ***************************************************************
  // Step #1:
  // Name the deployment
  // ***************************************************************
  async function inputDeploymentName(
    input: MultiStepInput,
    state: MultiStepState
  ) {
    state.step = state.lastStep + 1;

    const deploymentName = await input.showInputBox({
      title: state.title,
      step: state.step,
      totalSteps: state.totalSteps,
      value: typeof state.data.deploymentName === 'string' && state.data.deploymentName.length
        ? state.data.deploymentName
        : untitledDeploymentName(deploymentNames),
      prompt: 'Choose a unique name for the deployment',
      validate: (value) => {
        if (value.length < 3 ||
          !uniqueDeploymentName(value, deploymentNames) ||
          !isValidFilename(value)
        ) {
          return Promise.resolve({
            message: `Invalid Name: Value must be unique across other deployment names for this project, be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
    });

    state.data.deploymentName = deploymentName;
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  // ***************************************************************
  // Step #2:
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (accountListItems.length > 1) {
      const thisStepNumber = state.lastStep + 1;
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder: 'Select the credential you want to use to deploy',
        items: accountListItems,
        activeItem: typeof state.data.credentialName !== 'string' ? state.data.credentialName : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
      });
      state.data.credentialName = pick;
      state.lastStep = thisStepNumber;
    } else {
      state.data.credentialName = accountListItems[0];
    }
    return (input: MultiStepInput) => promptToDeploy(input, state);
  }

  // ***************************************************************
  // Step #3:
  // Does the user want to continue through into deploying the project?
  // ***************************************************************
  async function promptToDeploy(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const thisStepNumber = state.lastStep + 1;
    const pick = await input.showQuickPick({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
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
    state.lastStep = thisStepNumber;
    if (state.data.promptToDeploy.label === 'Yes') {
      return (input: MultiStepInput) => inputConfigFileSelection(input, state);
    }
    return undefined;
  }

  // ***************************************************************
  // Step #4:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputConfigFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (configFileListItems.length > 1) {
      const thisStepNumber = state.lastStep + 1;
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder: 'Select the config file you wish to deploy with',
        items: configFileListItems,
        activeItem: typeof state.data.configFile !== 'string' ? state.data.configFile : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
      });
      state.data.configFile = pick;
      state.lastStep = thisStepNumber;
    } else {
      state.data.configFile = configFileListItems[0];
    }
  }

  // ***************************************************************
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to 
  // collect the info.
  // ***************************************************************
  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    state.data.deploymentName === undefined ||
    state.data.credentialName === undefined ||
    state.data.promptToDeploy === undefined ||
    // have to add type guards here to eliminate the variability
    typeof (state.data.deploymentName) !== 'string' ||
    !isQuickPickItem(state.data.credentialName) ||
    !isQuickPickItem(state.data.promptToDeploy)
  ) {
    return;
  }

  // Create the Predeployment File
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
  // Should we deploy and did we get an answer for the config file?
  if (
    state.data.promptToDeploy.label === 'Yes' &&
    state.data.configFile !== undefined &&
    isQuickPickItem(state.data.configFile)
  ) {
    try {
      const response = await api.deployments.publish(
        state.data.deploymentName,
        state.data.credentialName.label,
        state.data.configFile.label,
      );
      deployProject(response.data.localId, stream);
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
      `Skipping deployment of this project`
    );
  }
}
