// Copyright (C) 2024 by Posit Software, PBC.

import {
  InputBoxValidationSeverity,
  ProgressLocation,
  QuickPickItem,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import {
  Configuration,
  ConfigurationDetails,
  Deployment,
  PreDeployment,
  contentTypeStrings,
  isConfigurationError,
  isPreDeployment,
  useApi,
} from "src/api";
import { getPythonInterpreterPath } from "src/utils/config";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItem,
  isQuickPickItemWithIndex,
} from "src/multiStepInputs/multiStepHelper";
import { untitledConfigurationName } from "src/utils/names";
import { calculateTitle } from "src/utils/titles";
import { filterConfigurationsToValidAndType } from "src/utils/filters";

export async function selectConfig(
  activeDeployment: Deployment | PreDeployment,
  viewId?: string,
): Promise<Configuration | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let configFileListItems: QuickPickItem[] = [];
  let configurations: Configuration[] = [];
  let entryPointListItems: QuickPickItemWithIndex[] = [];
  let configDetails: ConfigurationDetails[] = [];

  const createNewConfigurationLabel = "Create a New Configuration";

  const newConfigurationForced = (state?: MultiStepState): boolean => {
    if (!state) {
      return false;
    }
    return configurations.length === 0;
  };

  const newConfigurationSelected = (state?: MultiStepState): boolean => {
    if (!state) {
      return false;
    }
    return Boolean(
      state.data.existingConfigurationName &&
        isQuickPickItem(state.data.existingConfigurationName) &&
        state.data.existingConfigurationName.label ===
          createNewConfigurationLabel,
    );
  };

  const newConfigurationByAnyMeans = (state?: MultiStepState): boolean => {
    return newConfigurationForced(state) || newConfigurationSelected(state);
  };

  const hasMultipleEntryPoints = () => {
    return entryPointListItems.length > 1;
  };

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.configurations.getAll();
      let rawConfigs = response.data;
      // Filter down configs to same content type as active deployment,
      // but also allowing configs if active Deployment is a preDeployment
      // or if the deployment file has no content type assigned yet.
      if (!isPreDeployment(activeDeployment)) {
        configurations = filterConfigurationsToValidAndType(
          rawConfigs,
          activeDeployment.type,
        );
      } else {
        configurations = [];
        rawConfigs.forEach((config) => {
          if (!isConfigurationError(config)) {
            configurations.push(config);
          }
        });
      }
      configFileListItems = [];

      configurations.forEach((config) => {
        if (!isConfigurationError(config)) {
          const { title, problem } = calculateTitle(activeDeployment, config);
          if (problem) {
            return;
          }
          configFileListItems.push({
            iconPath: new ThemeIcon("gear"),
            label: title,
            detail: config.configurationName,
          });
        }
      });
      configFileListItems.sort((a: QuickPickItem, b: QuickPickItem) => {
        var x = a.label.toLowerCase();
        var y = b.label.toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
      });
      configFileListItems.push({
        iconPath: new ThemeIcon("plus"),
        label: createNewConfigurationLabel,
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "selectConfig, configurations.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue with API Error: ${summary}`,
      );
      return reject();
    }
    resolve();
  });

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
          "selectConfig, configurations.inspect",
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

  // wait for all of them to complete
  const apisComplete = Promise.all([
    getConfigurations,
    getConfigurationInspections,
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

  // Select the config file to use or create
  // Select the entrypoint, if there is more than one and creating
  // Prompt for title
  // Auto-name the config file to use - if creating
  // Call the APIs
  // return the config

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Select a Configuration",
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        // Note: We can't initialize existingConfigurationName to a specific initial
        // config, as we then wouldn't be able to detect if the user hit ESC to exit
        // the selection. :-(
        existingConfigurationName: undefined, // eventual type is QuickPickItem
        newConfigurationName: undefined, // eventual type is string
        entryPoint: undefined, // eventual type is isQuickPickItemWithIndex
        title: undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };
    // start the progression through the steps

    await MultiStepInput.run((input) => inputConfigFileSelection(input, state));
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step #1:
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputConfigFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!newConfigurationForced(state)) {
      const pick = await input.showQuickPick({
        title: state.title,
        step: 0, // suppression of step numbers
        totalSteps: 0,
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
      state.data.existingConfigurationName = pick;
      if (newConfigurationSelected(state)) {
        return (input: MultiStepInput) =>
          inputEntryPointSelection(input, state);
      }
      // last step, nothing gets returned.
      return;
    }
    // skip to entry point selection
    return inputEntryPointSelection(input, state);
  }

  // ***************************************************************
  // Step #1 or 2...
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputEntryPointSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (hasMultipleEntryPoints()) {
      const pick = await input.showQuickPick({
        title: "Create a Configuration",
        step: newConfigurationForced(state) ? 1 : 2,
        totalSteps: newConfigurationForced(state) ? 2 : 3,
        placeholder:
          "Select main file and content type below. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.entryPoint = pick;
      return (input: MultiStepInput) => inputTitle(input, state);
    } else {
      state.data.entryPoint = entryPointListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputTitle(input, state);
    }
  }

  // ***************************************************************
  // Step #1, 2 or 3...
  // Provide the title for the content
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    let initialValue = "";
    if (
      state.data.entryPoint &&
      isQuickPickItemWithIndex(state.data.entryPoint)
    ) {
      const detail = configDetails[state.data.entryPoint.index].title;
      if (detail) {
        initialValue = detail;
      }
    }
    const title = await input.showInputBox({
      title: "Create a Configuration",
      step: newConfigurationForced(state)
        ? hasMultipleEntryPoints()
          ? 2
          : 1
        : hasMultipleEntryPoints()
          ? 3
          : 2,
      totalSteps: newConfigurationForced(state)
        ? hasMultipleEntryPoints()
          ? 2
          : 1
        : hasMultipleEntryPoints()
          ? 3
          : 2,
      value:
        typeof state.data.title === "string" ? state.data.title : initialValue,
      prompt: "Enter a title for your content or application.",
      validate: (value) => {
        if (value.length < 3) {
          return Promise.resolve({
            message: `Invalid Title: Value must be longer than 3 characters`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.title = title;
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
  if (newConfigurationByAnyMeans(state)) {
    if (!state.data.title || !state.data.entryPoint) {
      return;
    }
  } else if (
    state.data.existingConfigurationName === undefined ||
    !isQuickPickItem(state.data.existingConfigurationName)
  ) {
    return;
  }

  if (newConfigurationByAnyMeans(state)) {
    if (!state.data.entryPoint || !state.data.title) {
      return;
    }
    if (
      !isQuickPickItemWithIndex(state.data.entryPoint) ||
      isQuickPickItem(state.data.title)
    ) {
      return;
    }

    // Create the Config File
    try {
      const configName = await untitledConfigurationName();
      const selectedConfigDetails = configDetails[state.data.entryPoint.index];
      if (!selectedConfigDetails) {
        window.showErrorMessage(
          `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}, index = ${state.data.entryPoint.index}`,
        );
        return;
      }
      selectedConfigDetails.title = state.data.title;
      const createResponse = await api.configurations.createOrUpdate(
        configName,
        selectedConfigDetails,
      );
      const fileUri = Uri.file(createResponse.data.configurationPath);
      const newConfig = createResponse.data;
      await commands.executeCommand("vscode.open", fileUri);
      return newConfig;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "selectConfig, configurations.createOrUpdate",
        error,
      );
      window.showErrorMessage(`Failed to create config file. ${summary}`);
      return;
    }
  } else if (
    state.data.existingConfigurationName &&
    isQuickPickItem(state.data.existingConfigurationName)
  ) {
    return configurations.find((config) => {
      // Have to re-apply typeguard since this is an annonoumus function
      if (
        state.data.existingConfigurationName &&
        isQuickPickItem(state.data.existingConfigurationName)
      ) {
        return (
          config.configurationName ===
          state.data.existingConfigurationName.label
        );
      }
      return false;
    });
  }
  return;
}
