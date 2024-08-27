// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";

import {
  InputBoxValidationSeverity,
  QuickPickItem,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  commands,
  window,
} from "vscode";

import {
  Configuration,
  ConfigurationError,
  ConfigurationInspectionResult,
  ContentRecord,
  ContentType,
  PreContentRecord,
  contentTypeStrings,
  isConfigurationError,
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
import { calculateTitle } from "src/utils/titles";
import {
  filterInspectionResultsToType,
  filterConfigurationsToValidAndType,
} from "src/utils/filters";
import { showProgressPassthrough } from "src/utils/progress";
import { isRelativePathRoot } from "src/utils/files";
import { newConfigFileNameFromTitle } from "src/utils/names";

export async function selectNewOrExistingConfig(
  activeDeployment: ContentRecord | PreContentRecord,
  viewId: string,
  activeConfiguration?: Configuration | ConfigurationError,
  // entryPoint?: string,
): Promise<Configuration | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let configFileListItems: QuickPickItem[] = [];
  let configurations: Configuration[] = [];
  let entryPointListItems: QuickPickItemWithIndex[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];

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

  // what are we going to filter on?
  // For this multiStepper, we want content type NOT entrypoint
  let effectiveContentTypeFilter = activeDeployment.type;
  if (effectiveContentTypeFilter === contentTypeStrings[ContentType.UNKNOWN]) {
    // if we don't have it within the activeDeployment type
    // then see if we can get it from active configuration file
    if (activeConfiguration && !isConfigurationError(activeConfiguration)) {
      effectiveContentTypeFilter = activeConfiguration.configuration.type;
    }
  }

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
    try {
      // get all configurations
      const response = await api.configurations.getAll(
        activeDeployment.projectDir,
      );
      let rawConfigs = response.data;
      // remove the errors
      configurations = configurations.filter(
        (cfg): cfg is Configuration => !isConfigurationError(cfg),
      );
      // Filter down configs to same content type as active deployment,
      // but also allowing configs if active Deployment is a preDeployment
      // or if the deployment file has no content type assigned yet.
      configurations = filterConfigurationsToValidAndType(
        rawConfigs,
        effectiveContentTypeFilter, // possibly UNKNOWN - in which case, no filtering will be done!
      );

      configFileListItems = [];

      // Display New Deployment at beginning
      configFileListItems.push({
        label: "New",
        kind: QuickPickItemKind.Separator,
      });
      configFileListItems.push({
        iconPath: new ThemeIcon("plus"),
        label: createNewConfigurationLabel,
        detail: "(or pick one of the existing deployments below)",
        picked: configurations.length ? false : true,
      });

      // Then we display the existing deployments
      if (configurations.length) {
        configFileListItems.push({
          label: "Existing",
          kind: QuickPickItemKind.Separator,
        });
      }
      let existingConfigFileListItems: QuickPickItem[] = [];
      configurations.forEach((config) => {
        const { title, problem } = calculateTitle(activeDeployment, config);
        if (problem) {
          return;
        }
        existingConfigFileListItems.push({
          iconPath: new ThemeIcon("gear"),
          label: title,
          detail: config.configurationName,
        });
      });
      existingConfigFileListItems.sort((a: QuickPickItem, b: QuickPickItem) => {
        var x = a.label.toLowerCase();
        var y = b.label.toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
      });
      // add to end of our list items
      configFileListItems = configFileListItems.concat(
        existingConfigFileListItems,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "selectNewOrExistingConfig, configurations.getAll",
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
        const inspectResponse = await api.configurations.inspect(
          activeDeployment.projectDir,
          python,
        );
        inspectionResults = filterInspectionResultsToType(
          inspectResponse.data,
          effectiveContentTypeFilter,
        );
        inspectionResults.forEach((result, i) => {
          const config = result.configuration;
          if (config.entrypoint) {
            entryPointListItems.push({
              iconPath: new ThemeIcon("file"),
              label: config.entrypoint,
              description: `(${contentTypeStrings[config.type]})`,
              detail: isRelativePathRoot(result.projectDir)
                ? undefined
                : `${result.projectDir}${path.sep}`,
              index: i,
            });
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "selectNewOrExistingConfig, configurations.inspect",
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
  // Select the config to be used w/ the contentRecord
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
      const detail =
        inspectionResults[state.data.entryPoint.index].configuration.title;
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
      finalValidation: (value) => {
        if (value.length < 3) {
          return Promise.resolve({
            message: `Error: Invalid Title (value must be longer than 3 characters)`,
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
  // Wait for the api promise to complete while showing progress
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************

  try {
    await showProgressPassthrough(
      "Initializing::collectInputs",
      viewId,
      async () =>
        await Promise.all([getConfigurations, getConfigurationInspections]),
    );
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
      const selectedInspectionResult =
        inspectionResults[state.data.entryPoint.index];
      if (!selectedInspectionResult) {
        window.showErrorMessage(
          `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}, index = ${state.data.entryPoint.index}`,
        );
        return;
      }

      const existingNames = (
        await api.configurations.getAll(selectedInspectionResult.projectDir)
      ).data.map((config) => config.configurationName);

      const configName = newConfigFileNameFromTitle(
        state.data.title,
        existingNames,
      );
      selectedInspectionResult.configuration.title = state.data.title;
      const createResponse = await api.configurations.createOrUpdate(
        configName,
        selectedInspectionResult.configuration,
        selectedInspectionResult.projectDir,
      );
      const fileUri = Uri.file(createResponse.data.configurationPath);
      const newConfig = createResponse.data;
      await commands.executeCommand("vscode.open", fileUri);
      return newConfig;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "selectNewOrExistingConfig, configurations.createOrUpdate",
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
          state.data.existingConfigurationName.detail
        );
      }
      return false;
    });
  }
  return;
}
