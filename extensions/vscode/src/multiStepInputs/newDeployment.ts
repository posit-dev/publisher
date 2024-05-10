// Copyright (C) 2024 by Posit Software, PBC.

import { ProgressLocation, QuickPickItem, ThemeIcon, window } from "vscode";

import { PreDeployment, isConfigurationError, useApi } from "src/api";
import { EventStream } from "src/events";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  deploymentNameValidator,
  untitledDeploymentName,
} from "src/utils/names";
import { deployProject } from "src/views/deployProgress";
import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "src/multiStepInputs/multiStepHelper";

export async function newDeployment(
  title: string,
  viewId?: string,
): Promise<PreDeployment | undefined>;
export async function newDeployment(
  title: string,
  viewId: string,
  allowPublish: true,
  stream: EventStream,
): Promise<PreDeployment | undefined>;
export async function newDeployment(
  title: string,
  viewId: string,
  allowPublish: false,
  stream?: undefined,
): Promise<PreDeployment | undefined>;
export async function newDeployment(
  title: string,
  viewId?: string,
  allowPublish?: boolean,
  stream?: EventStream,
): Promise<PreDeployment | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credentialListItems: QuickPickItem[] = [];
  let configFileListItems: QuickPickItem[] = [];
  let deploymentNames: string[] = [];

  const getCredentials = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.credentials.list();
      credentialListItems = response.data.map((cred) => ({
        iconPath: new ThemeIcon("account"),
        label: cred.name,
        description: cred.url,
      }));
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, credentials.list",
        error,
      );
      window.showInformationMessage(
        `Unable to continue with no credentials. ${summary}`,
      );
      return reject();
    }
    if (credentialListItems.length === 0) {
      window.showInformationMessage(
        `Unable to continue with no credentials.\n` +
          `Establish account credentials, then try again.`,
      );
      return reject();
    }
    return resolve();
  });

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
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
        "newDeployment, configurations.getAll",
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
    resolve();
  });

  const getDeployments = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.deployments.getAll();
      const deploymentList = response.data;
      // Note.. we want all of the deployment filenames regardless if they are valid or not.
      deploymentNames = deploymentList.map(
        (deployment) => deployment.deploymentName,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, deployments.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue due to deployment error. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  // wait for all of them to complete
  const apisComplete = Promise.all([
    getCredentials,
    getConfigurations,
    getDeployments,
  ]);

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
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Name the deployment
  // Select the credential to use, if there is more than one
  // Select the config file to use, if there are more than one
  // IF parameter 'allowPublish' is true, prompt to deploy
  // IF prompt to deploy was Yes, then call publish API
  // return name of deployment file

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title,
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        deploymentName: undefined, // eventual type is string
        credentialName: undefined, // eventual type is QuickPickItem
        configFile: undefined, // eventual type is QuickPickItem
        promptToDeploy: undefined, /// eventual type is QuickPickItem
      },
      promptStepNumbers: {},
    };
    // determin number of total steps, as each step
    // will suppress its choice if there is only one option
    let totalSteps = 4;
    if (credentialListItems.length === 1) {
      totalSteps -= 1;
    }
    if (configFileListItems.length === 1) {
      totalSteps -= 1;
    }
    if (!allowPublish) {
      totalSteps -= 1;
    }

    state.totalSteps = totalSteps;

    // start the progression through the steps

    await MultiStepInput.run((input) => inputDeploymentName(input, state));
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step #1:
  // Name the deployment
  // ***************************************************************
  async function inputDeploymentName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const thisStepNumber = assignStep(state, "inputDeploymentName");
    const currentName =
      typeof state.data.deploymentName === "string" &&
      state.data.deploymentName.length
        ? state.data.deploymentName
        : untitledDeploymentName(deploymentNames);

    const deploymentName = await input.showInputBox({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
      value: currentName,
      prompt: "Choose a unique name for the deployment",
      validate: deploymentNameValidator(deploymentNames, currentName),
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.deploymentName = deploymentName;
    state.lastStep = thisStepNumber;
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  // ***************************************************************
  // Step #2:
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
  // Step #3:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputConfigFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (configFileListItems.length > 1) {
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
      return (input: MultiStepInput) => promptToDeploy(input, state);
    } else {
      state.data.configFile = configFileListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return promptToDeploy(input, state);
    }
  }

  // ***************************************************************
  // Step #4:
  // Does the user want to continue through into deploying the project?
  // ***************************************************************
  async function promptToDeploy(input: MultiStepInput, state: MultiStepState) {
    if (allowPublish) {
      const thisStepNumber = assignStep(state, "promptToDeploy");
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Do you wish to initiate the deployment at this time? (Use this field to filter selections.)",
        items: [
          {
            label: "Yes",
            description: "Proceed with deployment",
          },
          {
            label: "No",
            description: "Just save my deployment for use at a later time",
          },
        ],
        activeItem:
          typeof state.data.promptToDeploy !== "string"
            ? state.data.promptToDeploy
            : undefined,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });
      state.data.promptToDeploy = pick;
      state.lastStep = thisStepNumber;
    }
    // last step, nothing gets returned.
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
    state.data.deploymentName === undefined ||
    state.data.credentialName === undefined ||
    state.data.configFile === undefined ||
    // have to add type guards here to eliminate the variability
    typeof state.data.deploymentName !== "string" ||
    !isQuickPickItem(state.data.credentialName) ||
    !isQuickPickItem(state.data.configFile)
  ) {
    return;
  }
  // additional checks if we are allowing publishing
  if (allowPublish) {
    if (
      state.data.promptToDeploy === undefined ||
      !isQuickPickItem(state.data.promptToDeploy)
    ) {
      return;
    }
  }
  // Create the Predeployment File
  let newPreDeployment: PreDeployment | undefined = undefined;
  try {
    const result = await api.deployments.createNew(
      state.data.credentialName.label,
      state.data.configFile.label,
      state.data.deploymentName,
    );
    newPreDeployment = result.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDeployment, createNew",
      error,
    );
    window.showInformationMessage(
      `Failed to create pre-deployment. ${summary}`,
    );
    return;
  }
  // Should we deploy?
  if (
    allowPublish &&
    stream &&
    state.data.promptToDeploy &&
    isQuickPickItem(state.data.promptToDeploy) &&
    state.data.promptToDeploy.label === "Yes"
  ) {
    try {
      const response = await api.deployments.publish(
        state.data.deploymentName,
        state.data.credentialName.label,
        state.data.configFile.label,
      );
      deployProject(response.data.localId, stream);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("newDeployment, deploy", error);
      window.showInformationMessage(`Failed to deploy . ${summary}`);
      return;
    }
  }
  return newPreDeployment;
}
