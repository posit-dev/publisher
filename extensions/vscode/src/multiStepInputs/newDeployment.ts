// Copyright (C) 2025 by Posit Software, PBC.

import path from "path";
import {
  InputStep,
  isQuickPickItem,
  isQuickPickItemWithInspectionResult,
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithInspectionResult,
} from "src/multiStepInputs/multiStepHelper";
import {
  commands,
  InputBoxValidationSeverity,
  QuickPickItem,
  QuickPickItemKind,
  ThemeIcon,
  Uri,
  window,
  workspace,
} from "vscode";

import {
  areInspectionResultsSimilarEnough,
  Configuration,
  ConfigurationInspectionResult,
  ContentType,
  contentTypeStrings,
  Credential,
  EntryPointPath,
  FileAction,
  PreContentRecord,
  ProductName,
  useApi,
} from "src/api";
import {
  getPythonInterpreterPath,
  getRInterpreterPath,
} from "src/utils/vscode";
import { getSummaryStringFromError } from "src/utils/errors";
import { isAxiosErrorWithJson } from "src/utils/errorTypes";
import { newConfigFileNameFromTitle, newDeploymentName } from "src/utils/names";
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
import { newCredential } from "./newCredential";
import {
  createNewCredentialLabel,
  isConnectCloud,
  getProductType,
} from "src/utils/multiStepHelpers";

const viewTitle = "Create a New Deployment";

export async function newDeployment(
  viewId: string,
  projectDir = ".",
  entryPointFile?: string,
): Promise<DeploymentObjects | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  // local step history that gets passed down to any sub-flows
  const stepHistory: InputStep[] = [];

  enum step {
    ENTRY_FILE_SELECTION = "inputEntryPointFileSelection",
    RETRIEVE_CONTENT_TYPES = "retrieveContentTypes",
    INPUT_CONTENT_TYPE = "inputContentType",
    INPUT_TITLE = "inputTitle",
    PICK_CREDENTIALS = "pickCredentials",
  }

  const steps: Record<
    step,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [step.ENTRY_FILE_SELECTION]: inputEntryPointFileSelection,
    [step.RETRIEVE_CONTENT_TYPES]: retrieveContentTypes,
    [step.INPUT_CONTENT_TYPE]: inputContentType,
    [step.INPUT_TITLE]: inputTitle,
    [step.PICK_CREDENTIALS]: pickCredentials,
  };

  let credentials: Credential[] = [];
  let credentialListItems: QuickPickItem[] = [];

  const entryPointListItems: QuickPickItem[] = [];
  let inspectionResults: ConfigurationInspectionResult[] = [];
  let inspectionQuickPicks: QuickPickItemWithInspectionResult[] = [];
  const contentRecordNames = new Map<string, string[]>();

  let newConfig: Configuration | undefined;
  let newOrSelectedCredential: Credential | undefined;
  let newContentRecord: PreContentRecord | undefined;

  const browseForEntrypointLabel = "Open...";

  // Collected Data
  type SelectedEntrypoint = {
    filePath?: string;
    inspectionResult?: ConfigurationInspectionResult;
    contentType?: ContentType;
  };
  type NewDeploymentData = {
    entrypoint: SelectedEntrypoint;
    title?: string;
    existingCredentialName?: string;
  };

  const newDeploymentData: NewDeploymentData = {
    entrypoint: {},
  };

  const newCredentialForced = (): boolean => {
    return credentials.length === 0;
  };

  const newCredentialSelected = (): boolean => {
    return Boolean(
      newDeploymentData?.existingCredentialName === createNewCredentialLabel,
    );
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
        iconPath: new ThemeIcon("posit-publisher-posit-logo"),
        label: credential.name,
        description: isConnectCloud(credential.serverType)
          ? ProductName.CONNECT_CLOUD
          : credential.url,
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

  const getInspectionQuickPicks = async () => {
    if (!newDeploymentData.entrypoint.filePath) {
      return;
    }
    // Have to create a copy of the guarded value, to keep language service happy
    // within anonymous function below
    const entryPointFilePath = path.join(
      projectDir,
      newDeploymentData.entrypoint.filePath,
    );

    inspectionQuickPicks = await showProgress(
      "Scanning::newDeployment",
      viewId,
      async () =>
        await getConfigurationInspectionQuickPicks(entryPointFilePath),
    );
  };

  const stepHistoryFlush = (name: string) => {
    if (!stepHistory.length) {
      // nothing to flush, bail!
      return;
    }
    // flush the step history after the step passed in if this is not the last step
    // added to the history so we don't double count the upcoming steps
    // this would mean the user landed back at this step from the backward flow
    if (stepHistory.at(-1)?.name !== name) {
      const index = stepHistory.findIndex((s) => s.name === name);
      if (index > -1) {
        stepHistory.splice(index + 1);
      }
    }
  };

  // ***************************************************************
  // Order of all steps for creating a new deployment
  // NOTE: This multi-stepper is used for multiple commands
  // ***************************************************************

  // Select the entrypoint, if there is more than one
  // Retrieve content types
  // Select the content type, if there is more than one
  // Prompt for Title
  // If no credentials, then create new credential
  // If some credentials, select either use of existing or creation of a new one
  // If creating credential:
  // - Select the platform
  // - Create a new Connect or Connect Cloud credential
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
      title: viewTitle,
      // We're going to temporarily disable display of steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {},
      promptStepNumbers: {},
      isValid: () => {},
    };

    let currentStep: InputStep;
    // we were passed in a specific file so retrieve the inspections
    if (entryPointFile) {
      currentStep = {
        name: step.RETRIEVE_CONTENT_TYPES,
        step: (input: MultiStepInput) =>
          steps[step.RETRIEVE_CONTENT_TYPES](input, state),
        skipStepHistory: true,
      };
      // we don't want to land on the retrieveContentTypes step in the backward flow
      // from sub-flows, so we don't register this step in the step history array
    } else {
      currentStep = {
        name: step.ENTRY_FILE_SELECTION,
        step: (input: MultiStepInput) =>
          steps[step.ENTRY_FILE_SELECTION](input, state),
      };
      stepHistory.push(currentStep);
    }

    // start the progression through the steps
    await MultiStepInput.run(currentStep);
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step: Select the entrypoint to be used w/ the contentRecord
  // ***************************************************************
  async function inputEntryPointFileSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    stepHistoryFlush(step.ENTRY_FILE_SELECTION);

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

    // use the selected entry point file and continue to inspection
    newDeploymentData.entrypoint.filePath = selectedEntrypointFile;

    // we don't want to land on the retrieveContentTypes step in the backward flow
    // from sub-flows, so we don't register this step in the step history array
    return {
      name: step.RETRIEVE_CONTENT_TYPES,
      step: (input: MultiStepInput) =>
        steps[step.RETRIEVE_CONTENT_TYPES](input, state),
      skipStepHistory: true,
    };
  }

  // ***************************************************************
  // Step: Retrieve the content types
  // ***************************************************************
  async function retrieveContentTypes(
    _: MultiStepInput,
    state: MultiStepState,
  ) {
    // use the passed in a specific file and continue to inspection
    newDeploymentData.entrypoint.filePath ||= entryPointFile;

    // get the inspections only after the `filePath` has been initialized
    await getInspectionQuickPicks();

    let currentStep: InputStep;
    // if we have multiple choices, select the content inspection result
    if (inspectionQuickPicks.length > 1) {
      currentStep = {
        name: step.INPUT_CONTENT_TYPE,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_CONTENT_TYPE](input, state),
      };
    } else {
      // otherwise auto select the only choice and input the title
      newDeploymentData.entrypoint.inspectionResult =
        inspectionQuickPicks[0].inspectionResult;
      currentStep = {
        name: step.INPUT_TITLE,
        step: (input: MultiStepInput) => steps[step.INPUT_TITLE](input, state),
      };
    }

    stepHistory.push(currentStep);
    return currentStep;
  }

  // ***************************************************************
  // Step: Select the content inspection result should use
  // ***************************************************************
  async function inputContentType(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    stepHistoryFlush(step.INPUT_CONTENT_TYPE);

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

    const currentStep = {
      name: step.INPUT_TITLE,
      step: (input: MultiStepInput) => steps[step.INPUT_TITLE](input, state),
    };
    stepHistory.push(currentStep);
    return currentStep;
  }

  // ***************************************************************
  // Step: Input the Title
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    stepHistoryFlush(step.INPUT_TITLE);

    // in case we have backed up from the subsequent check, we need to reset
    // the selection that it will update. This will allow steps to be the minimum number
    // as long as we don't know for certain it will take more steps.
    const initialValue =
      newDeploymentData.entrypoint.inspectionResult?.configuration.title || "";

    const title = await input.showInputBox({
      title: state.title,
      step: 0,
      totalSteps: 0,
      value: newDeploymentData.title || initialValue,
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

    // if there are existing credentials, allow the user to select one or create a new one
    if (!newCredentialForced()) {
      const currentStep = {
        name: step.PICK_CREDENTIALS,
        step: (input: MultiStepInput) =>
          steps[step.PICK_CREDENTIALS](input, state),
      };
      stepHistory.push(currentStep);
      return currentStep;
    }
    // there are no existing credentials, so force the user to create a new credential
    return await inputNewCredential();
  }

  // ***************************************************************
  // Step: Select the credential to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    stepHistoryFlush(step.PICK_CREDENTIALS);

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

    if (newCredentialSelected()) {
      // the user opted for creating a brand new credential
      return await inputNewCredential();
    }

    // the user selected an existing credential, making this the
    // last step to create a new deployment
    return;
  }

  // ***************************************************************
  // Create a new credential to be used
  // ***************************************************************
  async function inputNewCredential() {
    try {
      newOrSelectedCredential = await newCredential(
        viewId,
        viewTitle,
        undefined,
        stepHistory,
      );
    } catch {
      /* the user dismissed this flow, do nothing more */
    }

    // last step to create a new deployment
  }

  // ***************************************************************
  // Wait for the api promise to complete while showing progress.
  // Kick off the input collection and await until it completes.
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

  const isMissingCredentialData = () => {
    // either the existingCredentialName needs to be present and legitimate
    // or the newOrSelectedCredential object must be present
    return (
      (!newCredentialForced() &&
        (!newDeploymentData.existingCredentialName ||
          (newDeploymentData.existingCredentialName &&
            newCredentialSelected()))) ||
      (newCredentialForced() && !newOrSelectedCredential)
    );
  };

  // make sure user has not hit escape or moved away from the window
  // before completing the steps
  if (
    !newDeploymentData.entrypoint.filePath ||
    !newDeploymentData.entrypoint.inspectionResult ||
    !newDeploymentData.title ||
    isMissingCredentialData()
  ) {
    console.log("User has dismissed the New Deployment flow. Exiting.");
    return undefined;
  }

  if (!newOrSelectedCredential && newDeploymentData.existingCredentialName) {
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
  } else if (!newOrSelectedCredential) {
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

    newDeploymentData.entrypoint.inspectionResult.configuration.productType =
      getProductType(newOrSelectedCredential.serverType);

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
      newOrSelectedCredential.name,
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

  return {
    contentRecord: newContentRecord,
    configuration: newConfig,
    credential: newOrSelectedCredential,
  };
}
