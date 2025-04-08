// Copyright (C) 2024 by Posit Software, PBC.

import path from "path";
import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithInspectionResult,
  isQuickPickItem,
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
  FileAction,
} from "src/api";
import {
  getPythonInterpreterPath,
  getRInterpreterPath,
} from "src/utils/vscode";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { isAxiosErrorWithJson } from "src/utils/errorTypes";
import { newDeploymentName, newConfigFileNameFromTitle } from "src/utils/names";
import { formatURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { DeploymentObjects } from "src/types/shared";
import { showProgress } from "src/utils/progress";
import {
  getRelPathForConfig,
  getRelPathForContentRecord,
  relativeDir,
  relativePath,
  vscodeOpenFiles,
} from "src/utils/files";
import { ENTRYPOINT_FILE_EXTENSIONS } from "src/constants";
import { extensionSettings } from "src/extension";
import { findExistingCredentialByURL } from "src/multiStepInputs/common";

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

  const entryPointListItems: QuickPickItem[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];
  const contentRecordNames = new Map<string, string[]>();

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

  const newDeploymentData: NewDeploymentData = {
    entrypoint: {},
    newCredentials: {},
  };

  const newCredentialForced = (): boolean => {
    return credentials.length === 0;
  };

  const newCredentialSelected = (): boolean => {
    return Boolean(
      newDeploymentData?.existingCredentialName === createNewCredentialLabel,
    );
  };

  const newCredentialByAnyMeans = (): boolean => {
    return newCredentialForced() || newCredentialSelected();
  };

  const getConfigurationInspectionQuickPicks = async (
    relEntryPoint: EntryPointPath,
  ): Promise<QuickPickItemWithInspectionResult[]> => {
    const inspectionListItems: QuickPickItemWithInspectionResult[] = [];

    try {
      const python = await getPythonInterpreterPath();
      const r = await getRInterpreterPath();
      const relEntryPointDir = path.dirname(relEntryPoint);
      const relEntryPointFile = path.basename(relEntryPoint);

      const inspectResponse = await api.configurations.inspect(
        relEntryPointDir,
        python,
        r,
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
      if (isAxiosErrorWithJson(error)) {
        throw error;
      }
      const summary = getSummaryStringFromError(
        "newDeployment, configurations.inspect",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with project inspection failure for ${entryPointFile}. ${summary}`,
      );
      throw error;
    }
    if (!inspectionListItems.length) {
      const msg = `Unable to continue with no project entrypoints found during inspection for ${entryPointFile}.`;
      window.showErrorMessage(msg);
      throw new Error(msg);
    }
    return inspectionListItems;
  };

  const getCredentials = async (): Promise<void> => {
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
      throw error;
    }
  };

  const getEntrypoints = () => {
    if (entryPointFile) {
      // we were passed in a specific entrypoint file.
      // while we don't need it, we'll still provide the results
      // in the same way.
      const entryPointPath = path.join(projectDir, entryPointFile);
      entryPointListItems.push({
        iconPath: new ThemeIcon("file"),
        label: entryPointPath,
      });
      return;
    }

    // build up a list of open files, relative to the opened workspace folder
    const filteredOpenFileList = vscodeOpenFiles().filter((openFilePath) => {
      const parsedPath = path.parse(openFilePath);
      return ENTRYPOINT_FILE_EXTENSIONS.includes(parsedPath.ext.toLowerCase());
    });
    filteredOpenFileList.sort();

    // build the entrypointList
    if (filteredOpenFileList.length) {
      entryPointListItems.push({
        label: "Open Files",
        kind: QuickPickItemKind.Separator,
      });
      filteredOpenFileList.forEach((openFile) => {
        entryPointListItems.push({
          iconPath: new ThemeIcon("file"),
          label: openFile,
        });
      });
    }
    entryPointListItems.push({
      label: "Other",
      kind: QuickPickItemKind.Separator,
    });
    entryPointListItems.push({
      iconPath: new ThemeIcon("files"),
      label: browseForEntrypointLabel,
      detail: "Select a file as your entrypoint.",
    });
    return;
  };

  const getContentRecords = async () => {
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
      throw error;
    }
  };

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
  // Step: Select the entrypoint to be used w/ the contentRecord
  // ***************************************************************
  async function inputEntryPointFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // show only if we were not passed in a file
    if (entryPointFile === undefined) {
      if (newDeploymentData.entrypoint.filePath) {
        entryPointListItems.forEach((item) => {
          item.picked = item.label === newDeploymentData.entrypoint.filePath;
        });
      }

      let selectedEntrypointFile: string | undefined = undefined;
      do {
        const pick = await input.showQuickPick({
          title: state.title,
          step: 0,
          totalSteps: 0,
          placeholder:
            "Select entrypoint file. This is your main file for your project. (Use this field to filter selections.)",
          items: entryPointListItems,
          buttons: [],
          shouldResume: () => Promise.resolve(false),
          ignoreFocusOut: true,
        });

        if (pick.label === browseForEntrypointLabel) {
          let baseUri = Uri.parse(".");
          const workspaceFolders = workspace.workspaceFolders;
          if (workspaceFolders !== undefined) {
            baseUri = workspaceFolders[0].uri;
          }
          selectedEntrypointFile = undefined;
          const fileUris = await window.showOpenDialog({
            defaultUri: baseUri,
            openLabel: "Select",
            canSelectFolders: false,
            canSelectMany: false,
            title: "Select Entrypoint File (main file for your project)",
          });
          if (!fileUris || !fileUris[0]) {
            // canceled.
            continue;
          }
          const fileUri = fileUris[0];

          if (relativeDir(fileUri)) {
            selectedEntrypointFile = relativePath(fileUri);
          } else {
            window.showErrorMessage(
              `Entrypoint files must be located within the open workspace.`,
              {
                modal: true,
              },
            );
            selectedEntrypointFile = undefined;
          }
        } else {
          if (isQuickPickItem(pick)) {
            selectedEntrypointFile = pick.label;
          } else {
            return;
          }
        }
      } while (!selectedEntrypointFile);
      newDeploymentData.entrypoint.filePath = selectedEntrypointFile;
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
  // Step: Select the content inspection result should use
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
    const entryPointFilePath = path.join(
      projectDir,
      newDeploymentData.entrypoint.filePath,
    );

    const inspectionQuickPicks = await showProgress(
      "Scanning::newDeployment",
      viewId,
      async () =>
        await getConfigurationInspectionQuickPicks(entryPointFilePath),
    );

    // skip if we only have one choice.
    if (inspectionQuickPicks.length > 1) {
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
        step: 0,
        totalSteps: 0,
        placeholder: `Select the content type for your entrypoint file (${newDeploymentData.entrypoint.filePath}).`,
        items: inspectionQuickPicks,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      if (!pick || !isQuickPickItemWithInspectionResult(pick)) {
        return;
      }

      newDeploymentData.entrypoint.inspectionResult = pick.inspectionResult;
      return (input: MultiStepInput) => inputTitle(input, state);
    } else {
      newDeploymentData.entrypoint.inspectionResult =
        inspectionQuickPicks[0].inspectionResult;
      // We're skipping this step, so we must silently just jump to the next step
      return inputTitle(input, state);
    }
  }

  // ***************************************************************
  // Step: Input the Title
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    // in case we have backed up from the subsequent check, we need to reset
    // the selection that it will update. This will allow steps to be the minimum number
    // as long as we don't know for certain it will take more steps.

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
      step: 0,
      totalSteps: 0,
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
  // Step: Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    if (!newCredentialForced()) {
      if (newDeploymentData.existingCredentialName) {
        credentialListItems.forEach((credential) => {
          credential.picked =
            credential.label === newDeploymentData.existingCredentialName;
        });
      }
      const pick = await input.showQuickPick({
        title: state.title,
        step: 0,
        totalSteps: 0,
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
  // Step: New Credentials - Get the server url
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    if (newCredentialByAnyMeans()) {
      let currentURL = newDeploymentData.newCredentials.url
        ? newDeploymentData.newCredentials.url
        : "";

      if (currentURL === "") {
        currentURL = await extensionSettings.defaultConnectServer();
      }

      // Two credentials for the same URL is not allowed so clear the default if one is found
      if (
        currentURL !== "" &&
        findExistingCredentialByURL(credentials, currentURL) !== undefined
      ) {
        currentURL = "";
      }

      const url = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: 0,
        value: currentURL,
        prompt: "Please provide the Posit Connect server's URL",
        placeholder: "Server URL",
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
          const existingCredential = findExistingCredentialByURL(
            credentials,
            input,
          );
          if (existingCredential) {
            return Promise.resolve({
              message: `Error: Invalid URL (this server URL is already assigned to your credential "${existingCredential.name}". Only one credential per unique URL is allowed).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          try {
            const testResult = await api.credentials.test(
              input,
              !extensionSettings.verifyCertificates(), // insecure = !verifyCertificates
            );
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
  // Step: New Credentials - Enter the API Key
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    if (newCredentialByAnyMeans()) {
      const currentAPIKey = newDeploymentData.newCredentials.apiKey
        ? newDeploymentData.newCredentials.apiKey
        : "";
      let validatedURL = "";

      const apiKey = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: 0,
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
            const testResult = await api.credentials.test(
              serverUrl,
              !extensionSettings.verifyCertificates(), // insecure = !verifyCertificates
              input,
            );
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
            // we have success, but credentials.test may have returned a different
            // url for us to use.
            if (testResult.data.url) {
              validatedURL = testResult.data.url;
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
      newDeploymentData.newCredentials.url = validatedURL;
      return (input: MultiStepInput) => inputCredentialName(input, state);
    }
    return inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step: New Credentials - Name the credential
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (newCredentialByAnyMeans()) {
      const currentName = newDeploymentData.newCredentials.name
        ? newDeploymentData.newCredentials.name
        : "";

      const name = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: 0,
        value: currentName,
        prompt: "Enter a unique nickname for this server.",
        placeholder: "Posit Connect",
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
        await Promise.all([
          getCredentials(),
          getEntrypoints(),
          getContentRecords(),
        ]),
    );
  } catch {
    // errors have already been displayed by the underlying promises..
    return undefined;
  }
  await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    !newDeploymentData.entrypoint.filePath ||
    !newDeploymentData.entrypoint.inspectionResult ||
    !newDeploymentData.title ||
    (!newCredentialByAnyMeans() && !newDeploymentData.existingCredentialName)
  ) {
    console.log("User has dismissed flow. Exiting.");
    return undefined;
  }

  // Maybe create a new credential?
  if (newCredentialByAnyMeans()) {
    // have to type guard here, will protect us against
    // cancellation.
    if (
      !newDeploymentData.newCredentials.url ||
      !newDeploymentData.newCredentials.apiKey ||
      !newDeploymentData.newCredentials.name
    ) {
      console.log("User has dismissed flow. Exiting.");
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
  let configCreateResponse: Configuration | undefined;

  newDeploymentData.entrypoint.inspectionResult.configuration.title =
    newDeploymentData.title;

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
    configCreateResponse = (
      await api.configurations.createOrUpdate(
        configName,
        newDeploymentData.entrypoint.inspectionResult.configuration,
        newDeploymentData.entrypoint.inspectionResult.projectDir,
      )
    ).data;
    const fileUri = Uri.file(configCreateResponse.configurationPath);
    newConfig = configCreateResponse;
    await commands.executeCommand("vscode.open", fileUri);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDeployment, configurations.createOrUpdate",
      error,
    );
    window.showErrorMessage(`Failed to create config file. ${summary}`);
    return undefined;
  }

  try {
    // Attempt to add the Config file to the files for deployment
    // If the configuration is invalid, for example 'unknown', this will fail
    await api.files.updateFileList(
      configName,
      getRelPathForConfig(configCreateResponse.configurationPath),
      FileAction.INCLUDE,
      newDeploymentData.entrypoint.inspectionResult.projectDir,
    );
  } catch (_error: unknown) {
    // continue on as it is not necessary to include .posit files for deployment
    console.debug(
      `Failed to add the configuration file '${configName}' to \`files\`.`,
    );
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

  try {
    const contentRecordPath = relativePath(
      Uri.file(newContentRecord.deploymentPath),
    );
    if (contentRecordPath === undefined) {
      throw new Error(
        "Unable to determine the relative path for the content record.",
      );
    }
    await api.files.updateFileList(
      configName,
      getRelPathForContentRecord(contentRecordPath),
      FileAction.INCLUDE,
      newDeploymentData.entrypoint.inspectionResult.projectDir,
    );
  } catch (_error: unknown) {
    // continue on as it is not necessary to include .posit files for deployment
    console.debug(
      `Failed to add the content record file '${newContentRecord.deploymentName}' to \`files\`.`,
    );
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
