// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";

import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  assignStep,
  isQuickPickItemWithIndex,
} from "src/multiStepInputs/multiStepHelper";

import {
  InputBoxValidationSeverity,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import {
  Configuration,
  ConfigurationInspectionResult,
  contentTypeStrings,
  useApi,
} from "../api";
import { getPythonInterpreterPath } from "../utils/config";
import { getSummaryStringFromError } from "../utils/errors";
import { untitledConfigurationName } from "../utils/names";
import { showProgress } from "src/utils/progress";

export async function newConfig(title: string, viewId?: string) {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let entryPointListItems: QuickPickItemWithIndex[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];

  const getConfigurationInspections = new Promise<void>(
    async (resolve, reject) => {
      try {
        const python = await getPythonInterpreterPath();
        const inspectResponse = await api.configurations.inspect(
          { dir: ".", recursive: true },
          python,
        );
        inspectionResults = inspectResponse.data;
        inspectionResults.forEach((result, i) => {
          const config = result.configuration;
          if (config.entrypoint) {
            entryPointListItems.push({
              iconPath: new ThemeIcon("file"),
              label: config.entrypoint,
              description: `(${contentTypeStrings[config.type]})`,
              detail: `${result.projectDir}${path.sep}`,
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

  const apiCalls = Promise.all([getConfigurationInspections]);

  // Start the progress indicator and have it stop when the API calls are complete
  showProgress("Initializing::newConfig", viewId, apiCalls);

  // ***************************************************************
  // Order of all steps
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Select the entrypoint,  if there is more than one
  // Prompt for Title
  // Autoname the config file to use, do not provide prompt
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
  // Select the config to be used w/ the contentRecord
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
      return (input: MultiStepInput) => inputTitle(input, state);
    } else {
      state.data.entryPoint = entryPointListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputTitle(input, state);
    }
  }

  // ***************************************************************
  // Step #2:
  // Enter the title
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    const thisStepNumber = assignStep(state, "inputTitle");
    let initialValue = "";
    if (
      state.data.entryPoint &&
      isQuickPickItemWithIndex(state.data.entryPoint)
    ) {
      const detail =
        inspectionResults[state.data.entryPoint.index].configuration.title;
      if (detail) {
        initialValue = detail;
      }
    }
    const configFileName = await input.showInputBox({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
      value:
        typeof state.data.title === "string" ? state.data.title : initialValue,
      prompt: "Enter a title for your content or application.",
      finalValidation: (value) => {
        if (value.length < 3) {
          return Promise.resolve({
            message: `Error: Invalid Title - value must be longer than 3 characters`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.title = configFileName;
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
    state.data.title === undefined ||
    // have to add type guards here to eliminate the variability
    !isQuickPickItemWithIndex(state.data.entryPoint) ||
    typeof state.data.title !== "string"
  ) {
    return;
  }
  // Create the Config File
  let newConfig: Configuration | undefined = undefined;
  try {
    const selectedInspectionResult =
      inspectionResults[state.data.entryPoint.index];
    if (!selectedInspectionResult) {
      window.showErrorMessage(
        `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}, index = ${state.data.entryPoint.index}`,
      );
      return;
    }
    selectedInspectionResult.configuration.title = state.data.title;
    const configName = await untitledConfigurationName(
      selectedInspectionResult.projectDir,
    );
    const createResponse = await api.configurations.createOrUpdate(
      configName,
      selectedInspectionResult.configuration,
      {
        dir: selectedInspectionResult.projectDir,
      },
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
