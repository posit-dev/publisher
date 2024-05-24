// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  assignStep,
  isQuickPickItemWithIndex,
} from "src/multiStepInputs/multiStepHelper";

import {
  InputBoxValidationSeverity,
  ProgressLocation,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import {
  Configuration,
  ConfigurationDetails,
  contentTypeStrings,
  useApi,
} from "../api";
import { getPythonInterpreterPath } from "../utils/config";
import { getSummaryStringFromError } from "../utils/errors";
import { isValidFilename } from "../utils/files";
import { untitledConfigurationName } from "../utils/names";

export async function newConfig(title: string, viewId?: string) {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let entryPointListItems: QuickPickItemWithIndex[] = [];
  let configDetails: ConfigurationDetails[] = [];
  let configNames: string[] = [];

  const getConfigurationInspections = new Promise<void>(
    async (resolve, reject) => {
      try {
        const python = await getPythonInterpreterPath();
        const inspectResponse = await api.configurations.inspect(python);
        configDetails = inspectResponse.data;
        configDetails.forEach((config, i) => {
          if (config.entrypoint) {
            entryPointListItems.push({
              iconPath: new ThemeIcon("file"),
              label: config.entrypoint,
              description: `(${contentTypeStrings[config.type]})`,
              index: i,
            });
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "newConfig, configurations.inspect",
          error,
        );
        window.showErrorMessage(
          `Unable to continue with project inspection failure. ${summary}`,
        );
        return reject();
      }
      if (!entryPointListItems.length) {
        const msg = `Unable to continue with no project entrypoints found during inspection`;
        window.showErrorMessage(msg);
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

  const apiCalls = Promise.all([
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
      return apiCalls;
    },
  );

  // ***************************************************************
  // Order of all steps
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Select the entrypoint,  if there is more than one
  // Name the config file to use
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
      promptStepNumbers: {},
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
  // Step #2:
  // Name the configuration
  // ***************************************************************
  async function inputConfigurationName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
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
    await apiCalls;
  } catch {
    // errors have already been displayed by the underlying promises..
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
    !isQuickPickItemWithIndex(state.data.entryPoint) ||
    typeof state.data.configFileName !== "string"
  ) {
    return;
  }
  // Create the Config File
  let newConfig: Configuration | undefined = undefined;
  try {
    const selectedConfigDetails = configDetails[state.data.entryPoint.index];
    if (!selectedConfigDetails) {
      window.showErrorMessage(
        `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}, index = ${state.data.entryPoint.index}`,
      );
      return;
    }
    const createResponse = await api.configurations.createOrUpdate(
      state.data.configFileName,
      selectedConfigDetails,
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
