// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
} from "./multiStepHelper";

import {
  InputBoxValidationSeverity,
  QuickPickItem,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import { useApi, ConfigurationDetails, Configuration } from "../api";
import { getSummaryStringFromError } from "../utils/errors";
import { untitledConfigurationName } from "../utils/names";
import { isValidFilename } from "../utils/files";

export async function newConfig(title: string, viewId: string) {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let entryPointLabels: string[] = [];
  let entryPointListItems: QuickPickItem[] = [];
  const entryPointLabelMap = new Map<string, ConfigurationDetails>();
  let configs: ConfigurationDetails[] = [];

  const apisComplete = new Promise<boolean>(async (resolve) => {
    try {
      const inspectResponse = await api.configurations.inspect();
      configs = inspectResponse.data;
      entryPointLabels = configs.map((config) => `${config.entrypoint}`);
      configs.forEach((config) => {
        if (config.entrypoint) {
          entryPointListItems.push({
            iconPath: new ThemeIcon("file"),
            label: config.entrypoint,
            description: `(type ${config.type})`,
          });
        }
      });
      for (let i = 0; i < configs.length; i++) {
        entryPointLabelMap.set(entryPointLabels[i], configs[i]);
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newConfig, configurations.inspect",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with project inspection failure. ${summary}`,
      );
      resolve(false);
      return;
    }
    if (!entryPointListItems.length) {
      const msg = `Unable to continue with no project entrypoints found during inspection`;
      window.showErrorMessage(msg);
      resolve(false);
      return;
    }
    resolve(true);
  });

  // Start the progress indicator and have it stop when the API calls are complete
  window.withProgress(
    {
      title: "Initializing",
      location: { viewId },
    },
    async (): Promise<boolean> => {
      return apisComplete;
    },
  );

  // ***************************************************************
  // Order of all steps
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Name the config file to use - if a fixedConfigurationName has not been supplied
  // Return the name of the config file, so it can be opened.

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: title,
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        entryPoint: undefined, /// eventual type is QuickPickItem
        configFileName: undefined, // eventual type is string
      },
    };
    // determine number of total steps, as each step
    let totalSteps = 2;
    if (entryPointListItems.length === 1) {
      totalSteps -= 1;
    }
    state.totalSteps = totalSteps;

    // start the progression through the steps

    await MultiStepInput.run((input) => inputEntryPointSelection(input, state));
    return state as MultiStepState;
  }
  // ***************************************************************
  // Step #1:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputEntryPointSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (entryPointListItems.length > 1) {
      const thisStepNumber = state.lastStep + 1;
      const pick = await input.showQuickPick({
        title: state.title,
        step: thisStepNumber,
        totalSteps: state.totalSteps,
        placeholder:
          "Select main file and content type below. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
      });

      state.data.entryPoint = pick;
      state.lastStep = thisStepNumber;
    } else {
      state.data.entryPoint = entryPointListItems[0];
    }
    return (input: MultiStepInput) => inputConfigurationName(input, state);
  }

  // ***************************************************************
  // Step #2:
  // Name the configuration
  // ***************************************************************
  async function inputConfigurationName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const thisStepNumber = state.lastStep + 1;
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
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
    });

    state.data.configFileName = configFileName;
    state.lastStep = thisStepNumber;
  }

  // ***************************************************************
  // Wait for the api promise to complete
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************
  const success = await apisComplete;
  if (!success) {
    return;
  }
  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    state.data.entryPoint === undefined ||
    state.data.configFileName === undefined ||
    // have to add type guards here to eliminate the variability
    !isQuickPickItem(state.data.entryPoint) ||
    typeof state.data.configFileName !== "string"
  ) {
    return;
  }
  // Create the Config File
  let newConfig: Configuration | undefined = undefined;
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
    newConfig = createResponse.data;
    const fileUri = Uri.file(newConfig.configurationPath);
    await commands.executeCommand("vscode.open", fileUri);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newConfig, configurations.createOrUpdate",
      error,
    );
    window.showErrorMessage(`Failed to create config file. ${summary}`);
    return;
  }
  return newConfig;
}
