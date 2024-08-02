// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";
import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItem,
  isQuickPickItemWithIndex,
} from "src/multiStepInputs/multiStepHelper";

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
  useApi,
  Credential,
  Configuration,
  PreContentRecord,
  contentTypeStrings,
  ConfigurationInspectionResult,
  EntryPointPath,
} from "src/api";
import { getPythonInterpreterPath } from "src/utils/config";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import {
  untitledConfigurationName,
  untitledContentRecordName,
} from "src/utils/names";
import { formatURL, normalizeURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { DeploymentObjects } from "src/types/shared";
import { showProgress } from "src/utils/progress";
import { vscodeOpenFiles } from "src/utils/files";

type stepInfo = {
  step: number;
  totalSteps: number;
};

type possibleSteps = {
  noCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: {
      singleContentType: stepInfo;
      multipleContentTypes: stepInfo;
    };
  };
  newCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: {
      singleContentType: stepInfo;
      multipleContentTypes: stepInfo;
    };
  };
  existingCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: {
      singleContentType: stepInfo;
      multipleContentTypes: stepInfo;
    };
  };
};

const steps: Record<string, possibleSteps | undefined> = {
  inputEntryPointFileSelection: {
    noCredentials: {
      singleEntryPoint: {
        step: 0, // not yet shown
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1,
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 1,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 0, // not yet shown
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 1,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0, // not yet shown
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1,
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 1,
          totalSteps: 4,
        },
      },
    },
  },
  inputEntryPointContentTypeSelection: {
    noCredentials: {
      singleEntryPoint: {
        step: 0, // still 0
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1, // not shown
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 2,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 0, // still 0
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1, // not shown
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 2,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0, // still 0
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 1, // not shown
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 2,
          totalSteps: 4,
        },
      },
    },
  },
  inputTitle: {
    noCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 2,
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 3,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 2,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 3,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 2,
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 3,
          totalSteps: 4,
        },
      },
    },
  },
  pickCredentials: {
    noCredentials: {
      singleEntryPoint: {
        step: 1, // not shown
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 2, // not shown
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 3, // not shown
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 4,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3,
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 4,
          totalSteps: 4,
        },
      },
    },
  },
  inputServerUrl: {
    noCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3,
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 4,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 3,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 4,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 5,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 2, // not shown
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3, // not shown
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 4, // not shown
          totalSteps: 4,
        },
      },
    },
  },
  inputAPIKey: {
    noCredentials: {
      singleEntryPoint: {
        step: 3,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 4,
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 5,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 4,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 5,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 6,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 2, // not shown
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3, // not shown
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 4, // not shown
          totalSteps: 4,
        },
      },
    },
  },
  inputCredentialName: {
    noCredentials: {
      singleEntryPoint: {
        step: 4,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 5,
          totalSteps: 5,
        },
        multipleContentTypes: {
          step: 6,
          totalSteps: 6,
        },
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 5,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 6,
          totalSteps: 6,
        },
        multipleContentTypes: {
          step: 7,
          totalSteps: 7,
        },
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 2, // not shown
        totalSteps: 2,
      },
      multipleEntryPoints: {
        singleContentType: {
          step: 3, // not shown
          totalSteps: 3,
        },
        multipleContentTypes: {
          step: 4, // not shown
          totalSteps: 4,
        },
      },
    },
  },
};

export async function newDeployment(
  viewId: string,
  projectDir = ".",
  entryPoint?: string,
): Promise<DeploymentObjects | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credentials: Credential[] = [];
  let credentialListItems: QuickPickItem[] = [];

  let discoveredEntryPoints: string[] = [];
  let entryPointListItems: QuickPickItem[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];
  let contentRecordNames = new Map<string, string[]>();

  let newConfig: Configuration | undefined;
  let newOrSelectedCredential: Credential | undefined;
  let newContentRecord: PreContentRecord | undefined;

  const createNewCredentialLabel = "Create a New Credential";

  const newCredentialForced = (state?: MultiStepState): boolean => {
    if (!state) {
      return false;
    }
    return credentials.length === 0;
  };

  const newCredentialSelected = (state?: MultiStepState): boolean => {
    if (!state) {
      return false;
    }
    return Boolean(
      state.data.credentialName &&
        isQuickPickItem(state.data.credentialName) &&
        state.data.credentialName.label === createNewCredentialLabel,
    );
  };

  const newCredentialByAnyMeans = (state?: MultiStepState): boolean => {
    return newCredentialForced(state) || newCredentialSelected(state);
  };

  const hasMultiplePossibleEntryPointFiles = () => {
    return entryPointListItems.length > 1;
  };

  const hasMultipleContentTypesForSelectedEntryPoint = () => {
    return inspectionResults.length > 1;
  };

  const getStepInfo = (
    stepId: string,
    multiStepState: MultiStepState,
  ): stepInfo | undefined => {
    const step = steps[stepId];
    if (!step) {
      // if we have not covered the step, then don't number it.
      return {
        step: 0,
        totalSteps: 0,
      };
    }
    if (newCredentialForced(multiStepState)) {
      if (hasMultiplePossibleEntryPointFiles()) {
        if (hasMultipleContentTypesForSelectedEntryPoint()) {
          return step.noCredentials.multipleEntryPoints.multipleContentTypes;
        }
        return step.noCredentials.multipleEntryPoints.singleContentType;
      }
      return step.noCredentials.singleEntryPoint;
    }
    if (newCredentialSelected(multiStepState)) {
      if (hasMultiplePossibleEntryPointFiles()) {
        if (hasMultipleContentTypesForSelectedEntryPoint()) {
          return step.newCredentials.multipleEntryPoints.multipleContentTypes;
        }
        return step.newCredentials.multipleEntryPoints.singleContentType;
      }
      return step.newCredentials.singleEntryPoint;
    }
    // else it has to be existing credential selected
    if (hasMultiplePossibleEntryPointFiles()) {
      if (hasMultipleContentTypesForSelectedEntryPoint()) {
        return step.existingCredentials.multipleEntryPoints
          .multipleContentTypes;
      }
      return step.existingCredentials.multipleEntryPoints.singleContentType;
    }
    return step.existingCredentials.singleEntryPoint;
  };

  const getConfigurationInspectionQuickPicks = (
    relEntryPoint: EntryPointPath,
  ) => {
    return new Promise<QuickPickItemWithIndex[]>(async (resolve, reject) => {
      const inspectionListItems: QuickPickItemWithIndex[] = [];

      try {
        const python = await getPythonInterpreterPath();
        const dir = path.dirname(relEntryPoint);
        const entryPointFile = path.basename(relEntryPoint);

        const inspectResponse = await api.configurations.inspect(dir, python, {
          entrypoint: entryPointFile,
        });

        inspectionResults = inspectResponse.data;
        inspectionResults.forEach((result, i) => {
          const config = result.configuration;
          if (config.entrypoint) {
            inspectionListItems.push({
              iconPath: new ThemeIcon("gear"),
              label: config.type.toString(),
              description: `(${contentTypeStrings[config.type]})`,
              index: i,
            });
          }
        });
      } catch (error: unknown) {
        const summary = getSummaryStringFromError(
          "newDeployment, configurations.inspect",
          error,
        );
        window.showErrorMessage(
          `Unable to continue with project inspection failure for ${entryPoint}. ${summary}`,
        );
        return reject();
      }
      if (!inspectionListItems.length) {
        const msg = `Unable to continue with no project entrypoints found during inspection for ${entryPoint}.`;
        window.showErrorMessage(msg);
        return reject();
      }
      return resolve(inspectionListItems);
    });
  };

  const getCredentials = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.credentials.list();
      credentials = response.data;
      credentialListItems = credentials.map((credential) => ({
        iconPath: new ThemeIcon("key"),
        label: credential.name,
        description: credential.url,
      }));
      credentialListItems.push({
        iconPath: new ThemeIcon("plus"),
        label: createNewCredentialLabel,
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, credentials.getAll",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with a failed API response. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  const getEntrypoints = new Promise<void>(async (resolve, reject) => {
    try {
      if (entryPoint) {
        // we were passed in a specific entrypoint file.
        // while we don't need it, we'll still provide the results
        // in the same way.
        entryPointListItems.push({
          iconPath: new ThemeIcon("file"),
          label: entryPoint,
        });
        return resolve();
      }
      const entrypointFilesOpened: string[] = [];
      const entrypointFilesUnopened: string[] = [];

      // rely upon the backend to tell us what are valid entrypoints
      const entryPointsResponse = await api.entrypoints.get(projectDir);
      discoveredEntryPoints = entryPointsResponse.data;

      // build up a list of open files, relative to the opened workspace folder
      const openFileList: string[] = vscodeOpenFiles();

      // loop through and now separate possible entrypoints into open or not
      discoveredEntryPoints.forEach((entrypointFile) => {
        if (
          openFileList.find(
            (f) => f.toLowerCase() === entrypointFile.toLowerCase(),
          )
        ) {
          entrypointFilesOpened.push(entrypointFile);
        } else {
          entrypointFilesUnopened.push(entrypointFile);
        }
      });

      // build the entrypointList
      if (entrypointFilesOpened.length) {
        entryPointListItems.push({
          label: "Open Files",
          kind: QuickPickItemKind.Separator,
        });
        entrypointFilesOpened.forEach((entryPointFile) => {
          entryPointListItems.push({
            iconPath: new ThemeIcon("file"),
            label: entryPointFile,
          });
        });
      }
      if (entrypointFilesUnopened.length) {
        entryPointListItems.push({
          label: "Discovered Entrypoints",
          kind: QuickPickItemKind.Separator,
        });
        entrypointFilesUnopened.forEach((entryPointFile) => {
          entryPointListItems.push({
            iconPath: new ThemeIcon("file"),
            label: entryPointFile,
          });
        });
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, entrypoints.get",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with project entrypoint detection failure. ${summary}`,
      );
      return reject();
    }
    if (!discoveredEntryPoints.length) {
      const msg = `Unable to continue with no project entrypoints found.`;
      window.showErrorMessage(msg);
      return reject();
    }
    return resolve();
  });

  const getContentRecords = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.contentRecords.getAll(
        projectDir ? projectDir : ".",
        {
          recursive: true,
        },
      );
      const contentRecordList = response.data;
      // Note.. we want all of the contentRecord filenames regardless if they are valid or not.
      contentRecordList.forEach((contentRecord) => {
        let existingList = contentRecordNames.get(contentRecord.projectDir);
        if (existingList === undefined) {
          existingList = [];
        }
        existingList.push(contentRecord.deploymentName);
        contentRecordNames.set(contentRecord.projectDir, existingList);
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newContentRecord, contentRecords.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue due to deployment error. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  const apisComplete = Promise.all([
    getCredentials,
    getEntrypoints,
    getContentRecords,
  ]);

  // Start the progress indicator and have it stop when the API calls are complete
  showProgress("Initializing::newDeployment", apisComplete, viewId);

  // ***************************************************************
  // Order of all steps
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Select the entrypoint, if there is more than one
  // Select the content type, if there is more than one
  // Prompt for Title
  // If no credentials, then skip to create new credential
  // If some credentials, select either use of existing or creation of a new one
  // If creating credential:
  // - Get the server url
  // - Get the credential nickname
  // - Get the API key
  // Auto-name the config file to use
  // Auto-name the contentRecord
  // Call APIs and hopefully succeed at everything
  // Return the names of the contentRecord, config and credentials

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Create a New Deployment",
      // We're going to temporarily disable display of steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        entryPointPath: undefined, // eventual type is QuickPickItem
        entryPoint: undefined, // eventual type is QuickPickItemWithIndex
        title: undefined, // eventual type is string
        credentialName: undefined, // eventual type is either a string or QuickPickItem
        url: undefined, // eventual type is string
        name: undefined, // eventual type is string
        apiKey: undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    // start the progression through the steps
    await MultiStepInput.run((input) =>
      inputEntryPointFileSelection(input, state),
    );
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step #1 - maybe?:
  // Select the entrypoint to be used w/ the contentRecord
  // ***************************************************************
  async function inputEntryPointFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // in case we have backed up from the subsequent check, we need to reset
    // the array that it will update. This will allow steps to be the minimum number
    // as long as we don't know it will take another one.
    inspectionResults = [];

    // show only if we have more than one potential entrypoint discovered
    if (discoveredEntryPoints.length > 1) {
      const step = getStepInfo("inputEntryPointFileSelection", state);
      if (!step) {
        throw new Error(
          "newDeployment::inputEntryPointSelection step info not found.",
        );
      }

      const pick = await input.showQuickPick({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
        placeholder:
          "Select entrypoint file. This is your main file for your project. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });
      state.data.entryPointPath = pick.label;
      return (input: MultiStepInput) =>
        inputEntryPointContentTypeSelection(input, state);
    } else {
      state.data.entryPointPath = discoveredEntryPoints[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputEntryPointContentTypeSelection(input, state);
    }
  }

  // ***************************************************************
  // Step #2 - maybe?:
  // Select the content type of the entrypoint
  // ***************************************************************
  async function inputEntryPointContentTypeSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!state.data.entryPointPath) {
      return;
    }

    // always relative
    const entryPointPath = isQuickPickItem(state.data.entryPointPath)
      ? state.data.entryPointPath.label
      : state.data.entryPointPath;

    const inspectionQuickPicksPromise =
      getConfigurationInspectionQuickPicks(entryPointPath);

    showProgress(
      "Scanning::newDeployment",
      inspectionQuickPicksPromise,
      viewId,
    );

    const inspectionQuickPicks = await inspectionQuickPicksPromise;

    // skip if we only have one choice.
    if (inspectionQuickPicks.length > 1) {
      const step = getStepInfo("inputEntryPointContentTypeSelection", state);
      if (!step) {
        throw new Error(
          "newDeployment::inputEntryPointSelection step info not found.",
        );
      }

      const pick = await input.showQuickPick({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
        placeholder: `Select the content type for your entrypoint file (${entryPointPath}).`,
        items: inspectionQuickPicks,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.entryPoint = pick;
      return (input: MultiStepInput) => inputTitle(input, state);
    } else {
      state.data.entryPoint = inspectionQuickPicks[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputTitle(input, state);
    }
  }

  // ***************************************************************
  // Step #2 - maybe
  // Input the Title
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    // in case we have backed up from the subsequent check, we need to reset
    // the selection that it will update. This will allow steps to be the minimum number
    // as long as we don't know for certain it will take more steps.
    state.data.credentialName = undefined;

    const step = getStepInfo("inputTitle", state);
    if (!step) {
      throw new Error("newDeployment::inputTitle step info not found.");
    }
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
      title: state.title,
      step: step.step,
      totalSteps: step.totalSteps,
      value:
        typeof state.data.title === "string" ? state.data.title : initialValue,
      prompt: "Enter a title for your content or application.",
      validate: (value) => {
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
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  // ***************************************************************
  // Step #3 - maybe
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    if (!newCredentialForced(state)) {
      const step = getStepInfo("pickCredentials", state);
      if (!step) {
        throw new Error("newDeployment::pickCredentials step info not found.");
      }
      const pick = await input.showQuickPick({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
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

      return (input: MultiStepInput) => inputServerUrl(input, state);
    }
    return inputServerUrl(input, state);
  }

  // ***************************************************************
  // Step #4 - maybe?:
  // Get the server url
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    if (newCredentialByAnyMeans(state)) {
      const currentURL =
        typeof state.data.url === "string" && state.data.url.length
          ? state.data.url
          : "";

      const step = getStepInfo("inputServerUrl", state);
      if (!step) {
        throw new Error("newDeployment::inputServerUrl step info not found.");
      }

      const url = await input.showInputBox({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
        value: currentURL,
        prompt: "Enter the Public URL of the Posit Connect Server",
        placeholder: "example: https://servername.com:3939",
        validate: (input: string) => {
          if (input.includes(" ")) {
            return Promise.resolve({
              message: "Error: Invalid URL (spaces are not allowed).",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        finalValidation: async (input: string) => {
          input = formatURL(input);
          try {
            // will validate that this is a valid URL
            new URL(input);
          } catch (e) {
            if (!(e instanceof TypeError)) {
              throw e;
            }
            return Promise.resolve({
              message: `Error: Invalid URL (${getMessageFromError(e)}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          const existingCredential = credentials.find(
            (credential) =>
              normalizeURL(input).toLowerCase() ===
              normalizeURL(credential.url).toLowerCase(),
          );
          if (existingCredential) {
            return Promise.resolve({
              message: `Error: Invalid URL (this server URL is already assigned to your credential "${existingCredential.name}". Only one credential per unique URL is allowed).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          try {
            const testResult = await api.credentials.test(input);
            if (testResult.status !== 200) {
              return Promise.resolve({
                message: `Error: Invalid URL (unable to validate connectivity with Server URL - API Call result: ${testResult.status} - ${testResult.statusText}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
            if (testResult.data.error) {
              return Promise.resolve({
                message: `Error: Invalid URL (${testResult.data.error.msg}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
          } catch (e) {
            return Promise.resolve({
              message: `Error: Invalid URL (unable to validate connectivity with Server URL - ${getMessageFromError(e)}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.url = formatURL(url.trim());
      return (input: MultiStepInput) => inputAPIKey(input, state);
    }
    return inputAPIKey(input, state);
  }

  // ***************************************************************
  // Step #5 - maybe?:
  // Enter the API Key
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    if (newCredentialByAnyMeans(state)) {
      const currentAPIKey =
        typeof state.data.apiKey === "string" && state.data.apiKey.length
          ? state.data.apiKey
          : "";

      const step = getStepInfo("inputAPIKey", state);
      if (!step) {
        throw new Error("newDeployment::inputAPIKey step info not found.");
      }

      const apiKey = await input.showInputBox({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
        password: true,
        value: currentAPIKey,
        prompt: `The API key to be used to authenticate with Posit Connect.
        See the [User Guide](https://docs.posit.co/connect/user/api-keys/index.html#api-keys-creating)
        for further information.`,
        validate: (input: string) => {
          if (input.includes(" ")) {
            return Promise.resolve({
              message: "Error: Invalid API Key (spaces are not allowed).",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        finalValidation: async (input: string) => {
          // first validate that the API key is formed correctly
          const errorMsg = checkSyntaxApiKey(input);
          if (errorMsg) {
            return Promise.resolve({
              message: `Error: Invalid API Key (${errorMsg}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          // url should always be defined by the time we get to this step
          // but we have to type guard it for the API
          const serverUrl =
            typeof state.data.url === "string" ? state.data.url : "";
          try {
            const testResult = await api.credentials.test(serverUrl, input);
            if (testResult.status !== 200) {
              return Promise.resolve({
                message: `Error: Invalid API Key (unable to validate API Key - API Call result: ${testResult.status} - ${testResult.statusText}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
            if (testResult.data.error) {
              return Promise.resolve({
                message: `Error: Invalid API Key (${testResult.data.error.msg}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
          } catch (e) {
            return Promise.resolve({
              message: `Error: Invalid API Key (${getMessageFromError(e)})`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.apiKey = apiKey;
      return (input: MultiStepInput) => inputCredentialName(input, state);
    }
    return inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step #6 - maybe?:
  // Name the credential
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (newCredentialByAnyMeans(state)) {
      const currentName =
        typeof state.data.name === "string" && state.data.name.length
          ? state.data.name
          : "";

      const step = getStepInfo("inputCredentialName", state);
      if (!step) {
        throw new Error(
          "newDeployment::inputCredentialName step info not found.",
        );
      }

      const name = await input.showInputBox({
        title: state.title,
        step: step.step,
        totalSteps: step.totalSteps,
        value: currentName,
        prompt: "Enter a Unique Nickname for your Credential.",
        placeholder: "example: Posit Connect",
        finalValidation: (input: string) => {
          input = input.trim();
          if (input === "") {
            return Promise.resolve({
              message: "Error: Invalid Nickname (a value is required).",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          if (credentials.find((credential) => credential.name === input)) {
            return Promise.resolve({
              message:
                "Error: Invalid Nickname (value is already in use by a different credential).",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          if (input === createNewCredentialLabel) {
            return Promise.resolve({
              message:
                "Error: Nickname is reserved for internal use. Please provide another value.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.name = name.trim();
    }
    // last step
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
    (!newCredentialForced(state) && state.data.credentialName === undefined) ||
    // credentialName can be either type
    state.data.entryPoint === undefined ||
    !isQuickPickItemWithIndex(state.data.entryPoint) ||
    state.data.title === undefined ||
    typeof state.data.title !== "string"
  ) {
    console.log("User has aborted flow. Exiting.");
    return;
  }

  // Maybe create a new credential?
  if (newCredentialByAnyMeans(state)) {
    // have to type guard here, will protect us against
    // cancellation.
    if (
      state.data.url === undefined ||
      isQuickPickItem(state.data.url) ||
      state.data.name === undefined ||
      isQuickPickItem(state.data.name) ||
      state.data.apiKey === undefined ||
      isQuickPickItem(state.data.apiKey)
    ) {
      throw new Error("NewDeployment Unexpected type guard failure @1");
    }
    try {
      // NEED an credential to be returned from this API
      // and assigned to newOrExistingCredential
      const response = await api.credentials.create(
        state.data.name,
        state.data.url,
        state.data.apiKey,
      );
      newOrSelectedCredential = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credentials::add", error);
      window.showInformationMessage(summary);
    }
  } else if (state.data.credentialName) {
    // If not creating, then we need to retrieve the one we're using.
    let targetName: string | undefined = undefined;
    if (isQuickPickItem(state.data.credentialName)) {
      targetName = state.data.credentialName.label;
    }
    if (targetName) {
      newOrSelectedCredential = credentials.find(
        (credential) => credential.name === targetName,
      );
    }
  } else {
    // we are not creating a credential but also do not have a required existing value
    throw new Error("NewDeployment Unexpected type guard failure @2");
  }

  // Create the Config File
  let configName: string | undefined;
  const selectedInspectionResult =
    inspectionResults[state.data.entryPoint.index];
  if (!selectedInspectionResult) {
    window.showErrorMessage(
      `Unable to proceed creating configuration. Error retrieving config for ${state.data.entryPoint.label}, index = ${state.data.entryPoint.index}`,
    );
    return;
  }
  selectedInspectionResult.configuration.title = state.data.title;

  try {
    configName = await untitledConfigurationName(
      selectedInspectionResult.projectDir,
    );
    const createResponse = await api.configurations.createOrUpdate(
      configName,
      selectedInspectionResult.configuration,
      selectedInspectionResult.projectDir,
    );
    const fileUri = Uri.file(createResponse.data.configurationPath);
    newConfig = createResponse.data;
    await commands.executeCommand("vscode.open", fileUri);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDeployment, configurations.createOrUpdate",
      error,
    );
    window.showErrorMessage(`Failed to create config file. ${summary}`);
    return;
  }

  let finalCredentialName = <string | undefined>undefined;
  if (
    newCredentialForced(state) &&
    state.data.name &&
    !isQuickPickItem(state.data.name)
  ) {
    finalCredentialName = state.data.name;
  } else if (!state.data.credentialName) {
    throw new Error("NewDeployment Unexpected type guard failure @3");
  } else if (
    newCredentialSelected(state) &&
    state.data.name &&
    !isQuickPickItem(state.data.name)
  ) {
    finalCredentialName = state.data.name;
  } else if (isQuickPickItem(state.data.credentialName)) {
    finalCredentialName = state.data.credentialName.label;
  }
  if (!finalCredentialName) {
    // should have assigned it by now. Logic error!
    throw new Error("NewDeployment Unexpected type guard failure @4");
  }

  // Create the PreContentRecord File
  try {
    let existingNames = contentRecordNames.get(
      selectedInspectionResult.projectDir,
    );
    if (!existingNames) {
      existingNames = [];
    }
    const contentRecordName = untitledContentRecordName(existingNames);
    const response = await api.contentRecords.createNew(
      selectedInspectionResult.projectDir,
      finalCredentialName,
      configName,
      contentRecordName,
    );
    newContentRecord = response.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDeployment, contentRecords.createNew",
      error,
    );
    window.showErrorMessage(
      `Failed to create pre-deployment record. ${summary}`,
    );
    return;
  }
  if (!newOrSelectedCredential) {
    throw new Error("NewDeployment Unexpected type guard failure @5");
  }
  return {
    contentRecord: newContentRecord,
    configuration: newConfig,
    credential: newOrSelectedCredential,
  };
}
