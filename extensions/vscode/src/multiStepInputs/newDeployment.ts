// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";
import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  QuickPickItemWithInspectionResult,
  isQuickPickItemWithIndex,
  isQuickPickItemWithInspectionResult,
} from "src/multiStepInputs/multiStepHelper";

import {
  InputBoxValidationSeverity,
  QuickPickItem,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  commands,
  window,
  workspace,
} from "vscode";

import {
  useApi,
  Credential,
  Configuration,
  PreContentRecord,
  contentTypeStrings,
  ConfigurationInspectionResult,
  EntryPointPath,
  areInspectionResultsSimilarEnough,
  ContentType,
  allValidContentTypes,
} from "src/api";
import { getPythonInterpreterPath } from "src/utils/config";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { newDeploymentName, newConfigFileNameFromTitle } from "src/utils/names";
import { formatURL, normalizeURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { DeploymentObjects } from "src/types/shared";
import { showProgress } from "src/utils/progress";
import { relativeDir, relativePath, vscodeOpenFiles } from "src/utils/files";
import { ENTRYPOINT_FILE_EXTENSIONS } from "src/constants";

// type stepInfo = {
//   step: number;
//   totalSteps: number;
// };

// type possibleSteps = {
//   noCredentials: {
//     singleEntryPoint: stepInfo;
//     multipleEntryPoints: {
//       singleContentType: stepInfo;
//       multipleContentTypes: stepInfo;
//     };
//   };
//   newCredentials: {
//     singleEntryPoint: stepInfo;
//     multipleEntryPoints: {
//       singleContentType: stepInfo;
//       multipleContentTypes: stepInfo;
//     };
//   };
//   existingCredentials: {
//     singleEntryPoint: stepInfo;
//     multipleEntryPoints: {
//       singleContentType: stepInfo;
//       multipleContentTypes: stepInfo;
//     };
//   };
// };

// const steps: Record<string, possibleSteps | undefined> = {
//   inputEntryPointFileSelection: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 0, // not yet shown
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1,
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 1,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 0, // not yet shown
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 1,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 0, // not yet shown
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1,
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 1,
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   inputEntryPointContentTypeSelection: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 0, // still 0
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1, // not shown
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 2,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 0, // still 0
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1, // not shown
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 2,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 0, // still 0
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 1, // not shown
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 2,
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   inputTitle: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 1,
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 2,
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 3,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 1,
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 2,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 3,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 1,
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 2,
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 3,
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   pickCredentials: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 1, // not shown
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 2, // not shown
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 3, // not shown
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 2,
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 4,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 2,
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3,
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 4,
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   inputServerUrl: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 2,
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3,
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 4,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 3,
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 4,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 5,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 2, // not shown
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3, // not shown
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 4, // not shown
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   inputAPIKey: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 3,
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 4,
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 5,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 4,
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 5,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 6,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 2, // not shown
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3, // not shown
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 4, // not shown
//           totalSteps: 4,
//         },
//       },
//     },
//   },
//   inputCredentialName: {
//     noCredentials: {
//       singleEntryPoint: {
//         step: 4,
//         totalSteps: 4,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 5,
//           totalSteps: 5,
//         },
//         multipleContentTypes: {
//           step: 6,
//           totalSteps: 6,
//         },
//       },
//     },
//     newCredentials: {
//       singleEntryPoint: {
//         step: 5,
//         totalSteps: 5,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 6,
//           totalSteps: 6,
//         },
//         multipleContentTypes: {
//           step: 7,
//           totalSteps: 7,
//         },
//       },
//     },
//     existingCredentials: {
//       singleEntryPoint: {
//         step: 2, // not shown
//         totalSteps: 2,
//       },
//       multipleEntryPoints: {
//         singleContentType: {
//           step: 3, // not shown
//           totalSteps: 3,
//         },
//         multipleContentTypes: {
//           step: 4, // not shown
//           totalSteps: 4,
//         },
//       },
//     },
//   },
// };

export async function newDeployment(
  viewId: string,
  projectDir = ".",
  entryPointFile?: string,
): Promise<DeploymentObjects | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credentials: Credential[] = [];
  let credentialListItems: QuickPickItem[] = [];

  let entryPointListItems: QuickPickItemWithInspectionResult[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];
  let contentRecordNames = new Map<string, string[]>();

  let newConfig: Configuration | undefined;
  let newOrSelectedCredential: Credential | undefined;
  let newContentRecord: PreContentRecord | undefined;

  const createNewCredentialLabel = "Create a New Credential";
  const browseForEntrypointLabel = "Open...";

  // Collected Data
  type SelectedEntrypoint = {
    filePath?: string;
    inspectionResult?: ConfigurationInspectionResult;
    contentType?: ContentType;
  };
  type NewCredentialAttrs = {
    url?: string;
    name?: string;
    apiKey?: string;
  };
  type NewDeploymentData = {
    entrypoint: SelectedEntrypoint;
    title?: string;
    existingCredentialName?: string;
    newCredentials: NewCredentialAttrs;
  };

  let newDeploymentData: NewDeploymentData = {
    entrypoint: {},
    newCredentials: {},
  };

  // let selectedEntrypoint: SelectedEntrypoint = {};
  // let newtitle: string | undefined = undefined;
  // let existingCredentialName: string | undefined = undefined;
  // let newCredentialURL: string | undefined = undefined;
  // let newCredentialName: string | undefined = undefined;
  // let newCredentialAPIKey: string | undefined = undefined;

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
      newDeploymentData?.existingCredentialName === createNewCredentialLabel,
    );
  };

  const newCredentialByAnyMeans = (state?: MultiStepState): boolean => {
    return newCredentialForced(state) || newCredentialSelected(state);
  };

  // const hasMultiplePossibleEntryPointFiles = () => {
  //   return inspectionResults.length > 1;
  // };

  // const hasMultipleContentTypesForSelectedEntryPoint = () => {
  //   return inspectionResults.length > 1;
  // };

  // const getStepInfo = (
  //   stepId: string,
  //   multiStepState: MultiStepState,
  // ): stepInfo | undefined => {
  //   const step = steps[stepId];
  //   if (!step) {
  //     // if we have not covered the step, then don't number it.
  //     return {
  //       step: 0,
  //       totalSteps: 0,
  //     };
  //   }
  //   if (newCredentialForced(multiStepState)) {
  //     if (hasMultiplePossibleEntryPointFiles()) {
  //       if (hasMultipleContentTypesForSelectedEntryPoint()) {
  //         return step.noCredentials.multipleEntryPoints.multipleContentTypes;
  //       }
  //       return step.noCredentials.multipleEntryPoints.singleContentType;
  //     }
  //     return step.noCredentials.singleEntryPoint;
  //   }
  //   if (newCredentialSelected(multiStepState)) {
  //     if (hasMultiplePossibleEntryPointFiles()) {
  //       if (hasMultipleContentTypesForSelectedEntryPoint()) {
  //         return step.newCredentials.multipleEntryPoints.multipleContentTypes;
  //       }
  //       return step.newCredentials.multipleEntryPoints.singleContentType;
  //     }
  //     return step.newCredentials.singleEntryPoint;
  //   }
  //   // else it has to be existing credential selected
  //   if (hasMultiplePossibleEntryPointFiles()) {
  //     if (hasMultipleContentTypesForSelectedEntryPoint()) {
  //       return step.existingCredentials.multipleEntryPoints
  //         .multipleContentTypes;
  //     }
  //     return step.existingCredentials.multipleEntryPoints.singleContentType;
  //   }
  //   return step.existingCredentials.singleEntryPoint;
  // };

  const getConfigurationInspectionQuickPicks = (
    relEntryPoint: EntryPointPath,
  ) => {
    return new Promise<QuickPickItemWithInspectionResult[]>(
      async (resolve, reject) => {
        const inspectionListItems: QuickPickItemWithInspectionResult[] = [];

        try {
          const python = await getPythonInterpreterPath();
          const relEntryPointDir = path.dirname(relEntryPoint);
          const relEntryPointFile = path.basename(relEntryPoint);

          const inspectResponse = await api.configurations.inspect(
            relEntryPointDir,
            python,
            {
              entrypoint: relEntryPointFile,
            },
          );

          inspectionResults = inspectResponse.data;
          inspectionResults.forEach((result) => {
            const config = result.configuration;
            if (config.entrypoint) {
              inspectionListItems.push({
                iconPath: new ThemeIcon("gear"),
                label: config.type.toString(),
                description: `(${contentTypeStrings[config.type]})`,
                inspectionResult: result,
              });
            }
          });
        } catch (error: unknown) {
          const summary = getSummaryStringFromError(
            "newDeployment, configurations.inspect",
            error,
          );
          window.showErrorMessage(
            `Unable to continue with project inspection failure for ${entryPointFile}. ${summary}`,
          );
          return reject();
        }
        if (!inspectionListItems.length) {
          const msg = `Unable to continue with no project entrypoints found during inspection for ${entryPointFile}.`;
          window.showErrorMessage(msg);
          return reject();
        }
        return resolve(inspectionListItems);
      },
    );
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
      return reject(summary);
    }
    return resolve();
  });

  const getEntrypoints = new Promise<void>(async (resolve, reject) => {
    if (entryPointFile) {
      // we were passed in a specific entrypoint file.
      // while we don't need it, we'll still provide the results
      // in the same way.
      const entryPointPath = path.join(projectDir, entryPointFile);
      entryPointListItems.push({
        iconPath: new ThemeIcon("file"),
        label: entryPointPath,
      });
      return resolve();
    }

    // build up a list of open files, relative to the opened workspace folder
    const rawOpenFileList: string[] = vscodeOpenFiles();
    const filteredOpenFileList: string[] = [];
    rawOpenFileList.forEach((openFilePath) => {
      const parsedPath = path.parse(openFilePath);
      if (ENTRYPOINT_FILE_EXTENSIONS.includes(parsedPath.ext)) {
        filteredOpenFileList.push(openFilePath);
      }
    });
    filteredOpenFileList.sort();

    // build the entrypointList
    if (filteredOpenFileList.length) {
      entryPointListItems.push({
        label: "Open Files",
        kind: QuickPickItemKind.Separator,
      });
      const python = await getPythonInterpreterPath();
      for (const openFile of filteredOpenFileList) {
        // inspect each file type
        try {
          const relEntryPointDir = path.dirname(openFile);
          const relEntryPointFile = path.basename(openFile);

          const inspectResponse = await api.configurations.inspect(
            relEntryPointDir,
            python,
            {
              entrypoint: relEntryPointFile,
            },
          );
          inspectionResults = inspectResponse.data;
          inspectionResults.forEach((result) => {
            const config = result.configuration;
            entryPointListItems.push({
              iconPath: new ThemeIcon("file"),
              label: openFile,
              detail: `${config.type.toString()} (${contentTypeStrings[config.type]})`,
              inspectionResult: result,
            });
          });
        } catch (error: unknown) {
          // pass up the rejection
          reject(error);
        }
      }
    }
    entryPointListItems.push({
      label: "Other",
      kind: QuickPickItemKind.Separator,
    });
    entryPointListItems.push({
      iconPath: new ThemeIcon("file"),
      label: browseForEntrypointLabel,
      detail: "Use the File Open Dialog to select your entrypoint file. ",
    });
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
      data: {},
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

    // show only if we were not passed in a file
    if (entryPointFile === undefined) {
      // const step = getStepInfo("inputEntryPointFileSelection", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputEntryPointFileSelection step info not found.",
      //   );
      //   return;
      // }

      if (newDeploymentData.entrypoint.filePath) {
        entryPointListItems.forEach((item) => {
          item.picked = item.label === newDeploymentData.entrypoint.filePath;
        });
      }

      const pick = await input.showQuickPick({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
        placeholder:
          "Select entrypoint file. This is your main file for your project. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      let selectedEntrypointFile: string | undefined = undefined;
      if (pick.label === browseForEntrypointLabel) {
        let baseUri = Uri.parse(".");
        const workspaceFolders = workspace.workspaceFolders;
        if (workspaceFolders !== undefined) {
          baseUri = workspaceFolders[0].uri;
        }
        selectedEntrypointFile = undefined;
        do {
          const fileUris = await window.showOpenDialog({
            defaultUri: baseUri,
            openLabel: "Select",
            canSelectFolders: false,
            canSelectMany: false,
            title: "Select Entrypoint File (main file for your project)",
          });
          if (!fileUris || !fileUris[0]) {
            // cancelled.
            return;
          }
          const fileUri = fileUris[0];

          if (relativeDir(fileUri)) {
            selectedEntrypointFile = relativePath(fileUri);
          } else {
            window.showErrorMessage(
              `Entrypoint files must be located within the folder opened by VSCode. 
							File ${fileUri.fsPath} is not located within the VSCode Workspace: ${baseUri.fsPath}.`,
              {
                modal: true,
              },
            );
            selectedEntrypointFile = undefined;
          }
        } while (!selectedEntrypointFile);
        newDeploymentData.entrypoint.filePath = selectedEntrypointFile;
        newDeploymentData.entrypoint.inspectionResult = undefined;
      } else {
        if (isQuickPickItemWithInspectionResult(pick)) {
          newDeploymentData.entrypoint.filePath = pick.label;
          newDeploymentData.entrypoint.inspectionResult = pick.inspectionResult;
        } else {
          return;
        }
      }
      return (input: MultiStepInput) =>
        inputEntryPointInspectionResultSelection(input, state);
    } else {
      // We were passed in a specific file, so set and continue to inspection
      newDeploymentData.entrypoint.filePath = entryPointFile;
      // We're skipping this step, so we must silently just jump to the next step
      return inputEntryPointInspectionResultSelection(input, state);
    }
  }

  // ***************************************************************
  // Step #2 - maybe?:
  // Select the content inspection result should use
  // ***************************************************************
  async function inputEntryPointInspectionResultSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!newDeploymentData.entrypoint.filePath) {
      return;
    }
    // Have to create a copy of the guarded value, to keep language service happy
    // within anonymous function below
    const entryPointFile = newDeploymentData.entrypoint.filePath;

    const inspectionQuickPicks = await showProgress(
      "Scanning::newDeployment",
      viewId,
      async () => await getConfigurationInspectionQuickPicks(entryPointFile),
    );

    // skip if we only have one choice.
    if (inspectionQuickPicks.length > 1) {
      // const step = getStepInfo("inputEntryPointContentTypeSelection", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputEntryPointContentTypeSelection step info not found.",
      //   );
      //   return undefined;
      // }

      if (newDeploymentData.entrypoint.inspectionResult) {
        inspectionQuickPicks.forEach((pick) => {
          if (
            pick.inspectionResult &&
            newDeploymentData.entrypoint.inspectionResult
          ) {
            pick.picked = areInspectionResultsSimilarEnough(
              pick.inspectionResult,
              newDeploymentData.entrypoint.inspectionResult,
            );
          }
        });
      }

      const pick = await input.showQuickPick({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
        placeholder: `Select the content type for your entrypoint file (${entryPointFile}).`,
        items: inspectionQuickPicks,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      if (!pick || !isQuickPickItemWithInspectionResult(pick)) {
        return;
      }

      newDeploymentData.entrypoint.inspectionResult = pick.inspectionResult;
      return (input: MultiStepInput) => inputContentType(input, state);
    } else {
      newDeploymentData.entrypoint.inspectionResult =
        inspectionQuickPicks[0].inspectionResult;
      // We're skipping this step, so we must silently just jump to the next step
      return inputContentType(input, state);
    }
  }

  // ***************************************************************
  // Step #?
  // Input the Content Type, if needed
  // ***************************************************************
  async function inputContentType(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!newDeploymentData.entrypoint.inspectionResult) {
      return;
    }
    if (
      newDeploymentData.entrypoint.inspectionResult.configuration.type ===
      ContentType.UNKNOWN
    ) {
      // have to prompt user for a content type, since we were unable to determine it.
      const quickPicks: QuickPickItemWithIndex[] = [];
      allValidContentTypes.forEach((contentType, index) => {
        quickPicks.push({
          label: contentType,
          detail: contentTypeStrings[contentType],
          picked: newDeploymentData.entrypoint.contentType === contentType,
          index,
        });
      });

      // const step = getStepInfo("inputContentType", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputContentType step info not found.",
      //   );
      //   return;
      // }

      const pick = await input.showQuickPick({
        title: state.title,
        step: 0, // state.step,
        totalSteps: 0, // state.totalSteps,
        placeholder: `Select the content type for your entrypoint file (${entryPointFile}).`,
        items: quickPicks,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      if (!pick) {
        return;
      }
      if (!isQuickPickItemWithIndex(pick)) {
        return;
      }
      newDeploymentData.entrypoint.contentType =
        allValidContentTypes[pick.index];

      return (input: MultiStepInput) => inputTitle(input, state);
    } else {
      newDeploymentData.entrypoint.contentType =
        newDeploymentData.entrypoint.inspectionResult.configuration.type;
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

    // const step = getStepInfo("inputTitle", state);
    // if (!step) {
    //   window.showErrorMessage(
    //     "Internal Error: newDeployment::inputTitle step info not found.",
    //   );
    //   return;
    // }
    let initialValue = "";
    if (newDeploymentData.entrypoint.inspectionResult) {
      const detail =
        newDeploymentData.entrypoint.inspectionResult.configuration.title;
      if (detail) {
        initialValue = detail;
      }
    }

    const title = await input.showInputBox({
      title: state.title,
      step: 0, // step.step,
      totalSteps: 0, // step.totalSteps,
      value: newDeploymentData.title ? newDeploymentData.title : initialValue,
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

    newDeploymentData.title = title;
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  // ***************************************************************
  // Step #3 - maybe
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    if (!newCredentialForced(state)) {
      // const step = getStepInfo("pickCredentials", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::pickCredentials step info not found.",
      //   );
      //   return;
      // }
      if (newDeploymentData.existingCredentialName) {
        credentialListItems.forEach((credential) => {
          credential.picked =
            credential.label === newDeploymentData.existingCredentialName;
        });
      }
      const pick = await input.showQuickPick({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
        placeholder:
          "Select the credential you want to use to deploy. (Use this field to filter selections.)",
        items: credentialListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });
      newDeploymentData.existingCredentialName = pick.label;

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
      const currentURL = newDeploymentData.newCredentials.url
        ? newDeploymentData.newCredentials.url
        : "";

      // const step = getStepInfo("inputServerUrl", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputServerUrl step info not found.",
      //   );
      //   return;
      // }

      const url = await input.showInputBox({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
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
              return Promise.resolve({
                message: `Internal Error: Unknown Error (${JSON.stringify(e)}).`,
                severity: InputBoxValidationSeverity.Error,
              });
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

      newDeploymentData.newCredentials.url = formatURL(url.trim());
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
      const currentAPIKey = newDeploymentData.newCredentials.apiKey
        ? newDeploymentData.newCredentials.apiKey
        : "";

      // const step = getStepInfo("inputAPIKey", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputAPIKey step info not found.",
      //   );
      //   return;
      // }

      const apiKey = await input.showInputBox({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
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
          const serverUrl = newDeploymentData.newCredentials.url
            ? newDeploymentData.newCredentials.url
            : "";
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

      newDeploymentData.newCredentials.apiKey = apiKey;
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
      const currentName = newDeploymentData.newCredentials.name
        ? newDeploymentData.newCredentials.name
        : "";

      // const step = getStepInfo("inputCredentialName", state);
      // if (!step) {
      //   window.showErrorMessage(
      //     "Internal Error: newDeployment::inputCredentialName step info not found.",
      //   );
      //   return;
      // }

      const name = await input.showInputBox({
        title: state.title,
        step: 0, // step.step,
        totalSteps: 0, // step.totalSteps,
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

      newDeploymentData.newCredentials.name = name.trim();
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
    await showProgress(
      "Initializing::newDeployment",
      viewId,
      async () =>
        await Promise.all([getCredentials, getEntrypoints, getContentRecords]),
    );
  } catch {
    // errors have already been displayed by the underlying promises..
    return undefined;
  }
  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    !newDeploymentData.entrypoint.filePath ||
    !newDeploymentData.entrypoint.contentType ||
    !newDeploymentData.entrypoint.inspectionResult ||
    !newDeploymentData.title ||
    !newDeploymentData.existingCredentialName
  ) {
    console.log("User has aborted flow. Exiting.");
    return undefined;
  }

  // Maybe create a new credential?
  if (newCredentialByAnyMeans(state)) {
    // have to type guard here, will protect us against
    // cancellation.
    if (
      !newDeploymentData.newCredentials.url ||
      !newDeploymentData.newCredentials.apiKey ||
      !newDeploymentData.newCredentials.name
    ) {
      window.showErrorMessage(
        "Internal Error: NewDeployment Unexpected type guard failure @1",
      );
      return undefined;
    }
    try {
      // NEED an credential to be returned from this API
      // and assigned to newOrExistingCredential
      const response = await api.credentials.create(
        newDeploymentData.newCredentials.name,
        newDeploymentData.newCredentials.url,
        newDeploymentData.newCredentials.apiKey,
      );
      newOrSelectedCredential = response.data;
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credentials::add", error);
      window.showInformationMessage(summary);
    }
  } else if (newDeploymentData.existingCredentialName) {
    newOrSelectedCredential = credentials.find(
      (credential) =>
        credential.name === newDeploymentData.existingCredentialName,
    );
    if (!newOrSelectedCredential) {
      window.showErrorMessage(
        `Internal Error: NewDeployment Unable to find credential: ${newDeploymentData.existingCredentialName}`,
      );
      return undefined;
    }
  } else {
    // we are not creating a credential but also do not have a required existing value
    window.showErrorMessage(
      "Internal Error: NewDeployment Unexpected type guard failure @2",
    );
    return undefined;
  }

  // Create the Config File
  let configName: string | undefined;

  newDeploymentData.entrypoint.inspectionResult.configuration.title =
    newDeploymentData.title;
  newDeploymentData.entrypoint.inspectionResult.configuration.type =
    newDeploymentData.entrypoint.contentType;

  try {
    const existingNames = (
      await api.configurations.getAll(
        newDeploymentData.entrypoint.inspectionResult.projectDir,
      )
    ).data.map((config) => config.configurationName);

    configName = newConfigFileNameFromTitle(
      newDeploymentData.title,
      existingNames,
    );
    const createResponse = await api.configurations.createOrUpdate(
      configName,
      newDeploymentData.entrypoint.inspectionResult.configuration,
      newDeploymentData.entrypoint.inspectionResult.projectDir,
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
    return undefined;
  }

  // Create the PreContentRecord File
  try {
    let existingNames = contentRecordNames.get(
      newDeploymentData.entrypoint.inspectionResult.projectDir,
    );
    if (!existingNames) {
      existingNames = [];
    }
    const contentRecordName = newDeploymentName(existingNames);
    const response = await api.contentRecords.createNew(
      newDeploymentData.entrypoint.inspectionResult.projectDir,
      newOrSelectedCredential?.name,
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
    return undefined;
  }
  if (!newOrSelectedCredential) {
    window.showErrorMessage(
      "Internal Error: NewDeployment Unexpected type guard failure @5",
    );
    return undefined;
  }
  return {
    contentRecord: newContentRecord,
    configuration: newConfig,
    credential: newOrSelectedCredential,
  };
}
