// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "src/multiStepInputs/multiStepHelper";

import {
  InputBoxValidationSeverity,
  ProgressLocation,
  QuickPickItem,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import { useApi, ConfigurationDetails } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  untitledConfigurationName,
  untitledDeploymentName,
} from "src/utils/names";
import { isValidFilename } from "src/utils/files";

export async function initWorkspaceWithFixedNames(viewId?: string) {
  await initWorkspace(viewId, "Untitled-1", "default");
}

export async function initWorkspace(
  viewId?: string,
  fixedDeploymentName?: string,
  fixedConfigurationName?: string,
) {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credsListItems: QuickPickItem[] = [];

  let entryPointLabels: string[] = [];
  let entryPointListItems: QuickPickItem[] = [];
  const entryPointLabelMap = new Map<string, ConfigurationDetails>();
  let configDetails: ConfigurationDetails[] = [];
  let configNames: string[] = [];

  const getCredentials = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.credentials.list();
      credsListItems = response.data.map((cred) => ({
        iconPath: new ThemeIcon("key"),
        label: cred.name,
        description: cred.url,
      }));
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "initWorkspace, credentials.list",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with no credentials. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  const getConfigurationInspections = new Promise<void>(
    async (resolve, reject) => {
      try {
        const inspectResponse = await api.configurations.inspect();
        configDetails = inspectResponse.data;
        entryPointLabels = configDetails.map(
          (config) => `${config.entrypoint}`,
        );
        configDetails.forEach((config) => {
          if (config.entrypoint) {
            entryPointListItems.push({
              iconPath: new ThemeIcon("file"),
              label: config.entrypoint,
              description: `(type ${config.type})`,
            });
          }
        });
        for (let i = 0; i < configDetails.length; i++) {
          entryPointLabelMap.set(entryPointLabels[i], configDetails[i]);
        }
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "initWorkspace, configurations.inspect",
          error,
        );
        window.showErrorMessage(
          `Unable to continue with project inspection failure. ${summary}`,
        );
        return reject();
      }
      if (!entryPointListItems.length) {
        window.showErrorMessage(
          `Unable to continue with no project entrypoints found during inspection`,
        );
        return reject();
      }
      return resolve();
    },
  );

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.configurations.getAll();
      configNames = response.data.map((config) => config.configurationName);
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newConfig, configurations.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue with failed configuration API call. ${summary}`,
      );
      return reject();
    }
    resolve();
  });

  const apisComplete = Promise.all([
    getCredentials,
    getConfigurationInspections,
    getConfigurations,
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

  // Name the deployment - if a fixedDeploymentName has not been supplied
  // Select the credential to use, if there is more than one
  // Select the entrypoint, if there is more than one
  // Name the config file to use - if a fixedConfigurationName has not been supplied
  // Return the name of the config file, so it can be opened.

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Initializing your Posit Publishing Project",
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        deploymentName: undefined, // eventual type is string
        credentialName: undefined, // eventual type is string
        entryPoint: undefined, /// eventual type is QuickPickItem
        configFileName: undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };
    // determine number of total steps, as each step
    let totalSteps = 4;
    if (entryPointListItems.length === 1) {
      totalSteps -= 1;
    }
    if (fixedDeploymentName) {
      totalSteps -= 1;
    }
    if (fixedConfigurationName) {
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
    if (!fixedDeploymentName) {
      const thisStepNumber = assignStep(state, "inputDeploymentName");
      const deploymentName = await input.showInputBox({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        value:
          typeof state.data.deploymentName === "string" &&
          state.data.deploymentName.length
            ? state.data.deploymentName
            : untitledDeploymentName([]),
        prompt: "Choose a unique name for the deployment",
        validate: (value) => {
          if (value.length < 3 || !isValidFilename(value)) {
            return Promise.resolve({
              message: `Invalid Name: Value must be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.deploymentName = deploymentName;
      state.lastStep = thisStepNumber;
      return (input: MultiStepInput) => pickCredentials(input, state);
    } else {
      state.data.deploymentName = fixedDeploymentName;
      // We're skipping this step, so we must silently just jump to the next step
      return pickCredentials(input, state);
    }
  }

  // ***************************************************************
  // Step #2:
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    // skip if we only have one choice.
    if (credsListItems.length > 1) {
      const thisStepNumber = assignStep(state, "pickCredentials");
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Select the credential you want to use to deploy. (Use this field to filter selections.)",
        items: credsListItems,
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
      return (input: MultiStepInput) => inputEntryPointSelection(input, state);
    } else {
      state.data.credentialName = credsListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputEntryPointSelection(input, state);
    }
  }

  // ***************************************************************
  // Step #3:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputEntryPointSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (entryPointListItems.length > 1) {
      const thisStepNumber = assignStep(state, "inputEntryPointSelection");
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Select main file and content type below. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.entryPoint = pick;
      state.lastStep = thisStepNumber;
      return (input: MultiStepInput) => inputConfigurationName(input, state);
    } else {
      state.data.entryPoint = entryPointListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputConfigurationName(input, state);
    }
  }

  // ***************************************************************
  // Step #4:
  // Name the configuration
  // ***************************************************************
  async function inputConfigurationName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!fixedConfigurationName) {
      const thisStepNumber = assignStep(state, "inputConfigurationName");
      const configFileName = await input.showInputBox({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        value: await untitledConfigurationName(),
        prompt: "Choose a unique name for the configuration",
        validate: (value) => {
          if (value.length < 3 || !isValidFilename(value)) {
            return Promise.resolve({
              message: `Invalid Name: Value must be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          if (configNames.includes(value)) {
            return Promise.resolve({
              message: `Invalid Name: Name is already in use for this project. Please enter a unique name.`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.configFileName = configFileName;
      state.lastStep = thisStepNumber;
    } else {
      state.data.configFileName = fixedConfigurationName;
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
    state.data.deploymentName === undefined ||
    state.data.credentialName === undefined ||
    state.data.entryPoint === undefined ||
    state.data.configFileName === undefined ||
    // have to add type guards here to eliminate the variability
    typeof state.data.deploymentName !== "string" ||
    !isQuickPickItem(state.data.credentialName) ||
    !isQuickPickItem(state.data.entryPoint) ||
    typeof state.data.configFileName !== "string"
  ) {
    return;
  }
  // Create the Config File
  try {
    const selectedConfig = entryPointLabelMap.get(state.data.entryPoint.label);
    if (!selectedConfig) {
      window.showErrorMessage(
        `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}`,
      );
      return;
    }
    const createResponse = await api.configurations.createOrUpdate(
      state.data.configFileName,
      selectedConfig,
    );
    const fileUri = Uri.file(createResponse.data.configurationPath);
    await commands.executeCommand("vscode.open", fileUri);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "initWorkspace, configurations.createOrUpdate",
      error,
    );
    window.showErrorMessage(`Failed to create config file. ${summary}`);
    return;
  }

  // Create the Predeployment File
  try {
    await api.deployments.createNew(
      state.data.credentialName.label,
      state.data.configFileName,
      state.data.deploymentName,
    );
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "initWorkspace, deployments.createNew",
      error,
    );
    window.showErrorMessage(`Failed to create pre-deployment file. ${summary}`);
    return;
  }
}
