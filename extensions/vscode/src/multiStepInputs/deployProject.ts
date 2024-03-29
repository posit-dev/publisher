// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
} from "./multiStepHelper";

import { QuickPickItem, ThemeIcon, window } from "vscode";

import {
  AccountAuthType,
  PreDeployment,
  Deployment,
  useApi,
  isConfigurationError,
} from "../api";
import { getSummaryStringFromError } from "../utils/errors";
import { deployProject } from "../views/deployProgress";
import { EventStream } from "../events";

export async function publishDeployment(
  deployment: PreDeployment | Deployment,
  stream: EventStream,
) {
  const api = useApi();

  // ***************************************************************
  // API Calls and results
  // ***************************************************************

  let accountListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];

  try {
    const response = await api.accounts.getAll();
    // account list is filtered to match the deployment being published
    accountListItems = response.data
      .filter((account) => account.url === deployment.serverUrl)
      .map((account) => ({
        iconPath: new ThemeIcon("account"),
        label: account.name,
        description: account.source,
        detail:
          account.authType === AccountAuthType.API_KEY
            ? "Using API Key"
            : `Using Token Auth for ${account.accountName}`,
      }));
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "publishDeployment, accounts.getAll",
      error,
    );
    window.showInformationMessage(
      `Unable to continue with no credentials. ${summary}`,
    );
    return;
  }
  if (accountListItems.length === 0) {
    window.showInformationMessage(
      `Unable to continue with no matching credentials for\n` +
        `deployment URL: ${deployment.serverUrl}\n` +
        `\n` +
        `Establish account credentials using rsconnect (R package) or\n` +
        `rsconnect-python (Python package) and then retry operation.`,
    );
    return;
  }

  try {
    const response = await api.configurations.getAll();
    const configurations = response.data;
    configFileListItems = [];

    configurations.forEach((configuration) => {
      if (!isConfigurationError(configuration)) {
        configFileListItems.push({
          iconPath: new ThemeIcon("file-code"),
          label: configuration.configurationName,
          detail: configuration.configurationPath,
        });
      }
    });
    configFileListItems.sort((a: QuickPickItem, b: QuickPickItem) => {
      var x = a.label.toLowerCase();
      var y = b.label.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "addDeployment, configurations.getAll",
      error,
    );
    window.showInformationMessage(
      `Unable to continue with no configurations. ${summary}`,
    );
    return;
  }
  if (configFileListItems.length === 0) {
    window.showInformationMessage(
      `Unable to continue with no configuration files.\n` +
        `Expand the configuration section and follow the instructions there\n` +
        `to create a configuration file. After updating any applicable values\n` +
        `retry the operation.`,
    );
    return;
  }

  // ***************************************************************
  // Order of all steps
  // ***************************************************************

  // Select the credential to use, if there is more than one
  // Select the config file to use, if there are more than one
  // result in calling publish API

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Deploy Your Project",
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled
        credentialName: undefined, // eventual type is QuickPickItem
        configFile: undefined, // eventual type is QuickPickItem
      },
    };

    // determin number of total steps, as each step
    // will suppress its choice if there is only one option
    let totalSteps = 2;
    if (accountListItems.length === 1) {
      totalSteps -= 1;
    }
    // We are not always guaranteed that we have a configuration name in a pre-deployment file
    // this could occur until the API is updated to store one when creating, but also can occur
    // if the user has edited the deployment file.
    if (configFileListItems.length === 1 || deployment.configurationName) {
      totalSteps -= 1;
    }
    state.totalSteps = totalSteps;

    await MultiStepInput.run((input) => pickCredentials(input, state));
    return state;
  }

  // ***************************************************************
  // Step #1:
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    // skip if we only have one choice.
    if (accountListItems.length > 1) {
      const thisStepNumber = state.lastStep + 1;
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder: "Select the credential you want to use to deploy",
        items: accountListItems,
        activeItem:
          typeof state.data.credentialName !== "string"
            ? state.data.credentialName
            : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
      });
      state.data.credentialName = pick;
      state.lastStep = thisStepNumber;
    } else {
      state.data.credentialName = accountListItems[0];
    }
    return (input: MultiStepInput) => inputConfigFileSelection(input, state);
  }

  // ***************************************************************
  // Step #2:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputConfigFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice or an already decided one
    if (configFileListItems.length > 1 || deployment.configurationName) {
      const thisStepNumber = state.lastStep + 1;
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder: "Select the config file you wish to deploy with",
        items: configFileListItems,
        activeItem:
          typeof state.data.configFile !== "string"
            ? state.data.configFile
            : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
      });
      state.data.configFile = pick;
      state.lastStep = thisStepNumber;
    } else {
      if (deployment.configurationName) {
        state.data.configFile = deployment.configurationName;
      } else {
        state.data.configFile = configFileListItems[0];
      }
    }
    // last step, we don't return anything
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
    state.data.credentialName === undefined ||
    state.data.configFile === undefined ||
    // have to add type guards here to eliminate the variability
    !isQuickPickItem(state.data.credentialName)
    // Note that state.data.configFile can either be a string or QuickPickItem!
  ) {
    return;
  }
  const credentialName = isQuickPickItem(state.data.configFile)
    ? state.data.configFile.label
    : state.data.configFile;

  // deploy!
  try {
    const response = await api.deployments.publish(
      deployment.saveName,
      state.data.credentialName.label,
      credentialName,
    );
    deployProject(response.data.localId, stream);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "publishDeployment, deploy",
      error,
    );
    window.showInformationMessage(`Failed to deploy . ${summary}`);
    return;
  }
}
