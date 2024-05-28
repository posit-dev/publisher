// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "./multiStepHelper";

import { ProgressLocation, QuickPickItem, ThemeIcon, window } from "vscode";

import {
  PreDeployment,
  Deployment,
  useApi,
  isConfigurationError,
  Configuration,
} from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { deployProject } from "src/views/deployProgress";
import { EventStream } from "src/events";

export async function publishDeployment(
  deployment: PreDeployment | Deployment,
  stream: EventStream,
  viewId?: string,
) {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credentialListItems: QuickPickItem[] = [];
  let configurations: Configuration[] = [];
  let automaticConfigurationName: string | undefined = undefined;
  let configFileListItems: QuickPickItem[] = [];

  const getCredentials = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.credentials.list();
      // credential list is filtered to match the deployment being published
      credentialListItems = response.data
        .filter(
          (credential) => credential.url.trim() === deployment.serverUrl.trim(),
        )
        .map((credential) => ({
          iconPath: new ThemeIcon("key"),
          label: credential.name,
          description: credential.url,
        }));
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "publishDeployment, credentials.list",
        error,
      );
      window.showInformationMessage(
        `Unable to continue with no credentials. ${summary}`,
      );
      return reject();
    }
    if (credentialListItems.length === 0) {
      window.showInformationMessage(
        `Unable to continue with no matching credentials for\n` +
          `deployment URL: ${deployment.serverUrl}\n` +
          `\n` +
          `Establish account credentials for the Server URL, then try again.`,
      );
      return reject();
    }
    return resolve();
  });

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.configurations.getAll();
      // save off our non-error configurations
      response.data.forEach((config) => {
        if (!isConfigurationError(config)) {
          configurations.push(config);
        }
      });
      // create our list items
      configFileListItems = [];
      configurations.forEach((configuration) => {
        if (!isConfigurationError(configuration)) {
          configFileListItems.push({
            iconPath: new ThemeIcon("gear"),
            label: configuration.configurationName,
            detail: configuration.configurationRelPath,
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
      return reject();
    }
    if (configFileListItems.length === 0) {
      window.showInformationMessage(
        `Unable to continue with no configuration files.\n` +
          `Expand the configuration section and follow the instructions there\n` +
          `to create a configuration file. After updating any applicable values\n` +
          `retry the operation.`,
      );
      return reject();
    }
    return resolve();
  });

  const apisComplete = Promise.all([getCredentials, getConfigurations]);

  // Start the progress indicator and have it stop when the API calls are complete
  window.withProgress(
    {
      title: "Initializing",
      location: viewId ? { viewId } : ProgressLocation.Window,
    },
    async () => {
      return apisComplete;
    },
  );

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
      promptStepNumbers: {},
    };

    // determin number of total steps, as each step
    // will suppress its choice if there is only one option
    let totalSteps = 2;
    if (credentialListItems.length === 1) {
      totalSteps -= 1;
    }
    // We are not always guaranteed that we have a configuration name in a pre-deployment file
    // this could occur until the API is updated to store one when creating, but also can occur
    // if the user has edited the deployment file. We could also be missing the config file that
    // was last deployed due to a rename or deletion.

    if (deployment.configurationName) {
      if (
        configurations.find(
          (config) => config.configurationName === deployment.configurationName,
        )
      ) {
        automaticConfigurationName = deployment.configurationName;
        totalSteps -= 1;
      }
    } else if (configFileListItems.length === 1) {
      automaticConfigurationName = configFileListItems[0].label;
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
    if (credentialListItems.length > 1) {
      const thisStepNumber = assignStep(state, "pickCredentials");
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Select the credential you want to use to deploy. (Use this field to filter selections.)",
        items: credentialListItems,
        activeItem:
          typeof state.data.credentialName !== "string"
            ? state.data.credentialName
            : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });
      state.data.credentialName = pick;
      state.lastStep = thisStepNumber;
      return (input: MultiStepInput) => inputConfigFileSelection(input, state);
    } else {
      state.data.credentialName = credentialListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputConfigFileSelection(input, state);
    }
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
    if (!automaticConfigurationName) {
      const thisStepNumber = assignStep(state, "inputConfigFileSelection");
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Select the config file you wish to deploy with. (Use this field to filter selections.)",
        items: configFileListItems,
        activeItem:
          typeof state.data.configFile !== "string"
            ? state.data.configFile
            : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });
      state.data.configFile = pick;
      state.lastStep = thisStepNumber;
    } else {
      state.data.configFile = automaticConfigurationName;
    }
    // last step, we don't return anything
  }

  // ***************************************************************
  // Wait for the api promise to complete
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************

  try {
    await apisComplete;
  } catch {
    // errors have already been displayed by the underlying promises..
    return;
  }
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
