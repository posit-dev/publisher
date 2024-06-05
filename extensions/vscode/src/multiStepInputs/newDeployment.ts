// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItem,
  isQuickPickItemWithIndex,
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

import {
  useApi,
  ConfigurationDetails,
  Credential,
  Configuration,
  PreContentRecord,
  contentTypeStrings,
} from "src/api";
import { getPythonInterpreterPath } from "src/utils/config";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  untitledConfigurationName,
  untitledContentRecordName,
} from "src/utils/names";
import { formatURL, normalizeURL } from "src/utils/url";
import { validateApiKey } from "src/utils/apiKeys";
import { DeploymentObjects } from "src/types/shared";

type stepInfo = {
  step: number;
  totalSteps: number;
};

type possibleSteps = {
  noCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: stepInfo;
  };
  newCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: stepInfo;
  };
  existingCredentials: {
    singleEntryPoint: stepInfo;
    multipleEntryPoints: stepInfo;
  };
};

const steps: Record<string, possibleSteps | undefined> = {
  pickCredentials: {
    noCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        step: 0,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 1,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 1,
        totalSteps: 3,
      },
    },
  },
  inputServerUrl: {
    noCredentials: {
      singleEntryPoint: {
        step: 1,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        step: 1,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 2,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 0,
        totalSteps: 3,
      },
    },
  },
  inputCredentialName: {
    noCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        step: 2,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 3,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 3,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 0,
        totalSteps: 3,
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
        step: 3,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 4,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 4,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 0,
        totalSteps: 3,
      },
    },
  },
  inputEntryPointSelection: {
    noCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        step: 4,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 5,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 0,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 2,
        totalSteps: 3,
      },
    },
  },
  inputTitle: {
    noCredentials: {
      singleEntryPoint: {
        step: 4,
        totalSteps: 4,
      },
      multipleEntryPoints: {
        step: 5,
        totalSteps: 5,
      },
    },
    newCredentials: {
      singleEntryPoint: {
        step: 5,
        totalSteps: 5,
      },
      multipleEntryPoints: {
        step: 6,
        totalSteps: 6,
      },
    },
    existingCredentials: {
      singleEntryPoint: {
        step: 2,
        totalSteps: 2,
      },
      multipleEntryPoints: {
        step: 3,
        totalSteps: 3,
      },
    },
  },
};

export async function newDeployment(
  viewId?: string,
): Promise<DeploymentObjects | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let credentials: Credential[] = [];
  let credentialListItems: QuickPickItem[] = [];

  let entryPointListItems: QuickPickItemWithIndex[] = [];
  let configDetails: ConfigurationDetails[] = [];
  let contentRecordNames: string[] = [];

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

  const hasMultipleEntryPoints = () => {
    return entryPointListItems.length > 1;
  };

  const getStepInfo = (
    stepId: string,
    multiStepState: MultiStepState,
  ): stepInfo | undefined => {
    const step = steps[stepId];
    if (!step) {
      return undefined;
    }
    if (newCredentialForced(multiStepState)) {
      if (hasMultipleEntryPoints()) {
        return step.noCredentials.multipleEntryPoints;
      }
      return step.noCredentials.singleEntryPoint;
    }
    if (newCredentialSelected(multiStepState)) {
      if (hasMultipleEntryPoints()) {
        return step.newCredentials.multipleEntryPoints;
      }
      return step.newCredentials.singleEntryPoint;
    }
    // else it has to be existing credential selected
    if (hasMultipleEntryPoints()) {
      return step.existingCredentials.multipleEntryPoints;
    }
    return step.existingCredentials.singleEntryPoint;
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
          "newDeployment, configurations.inspect",
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

  const getContentRecords = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.contentRecords.getAll();
      const contentRecordList = response.data;
      // Note.. we want all of the contentRecord filenames regardless if they are valid or not.
      contentRecordNames = contentRecordList.map(
        (contentRecord) => contentRecord.deploymentName,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newContentRecord, contentRecords.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue due to contentRecord error. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  const apisComplete = Promise.all([
    getCredentials,
    getConfigurationInspections,
    getContentRecords,
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

  // If no credentials, then skip to create new credential
  // If some credentials, select either use of existing or creation of a new one
  // If creating credential:
  // - Get the server url
  // - Get the credential nickname
  // - Get the API key
  // Select the entrypoint, if there is more than one
  // Prompt for Title
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
        credentialName: undefined, // eventual type is either a string or QuickPickItem
        newCredentialUrl: undefined, // eventual type is string
        newCredentialName: undefined, // eventual type is string
        newCredentialApiKey: undefined, // eventual type is string
        entryPoint: undefined, // eventual type is QuickPickItem
        title: undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    // start the progression through the steps
    await MultiStepInput.run((input) => pickCredentials(input, state));
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step #2:
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
  // Step #3 - maybe?:
  // Get the server url
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    if (newCredentialByAnyMeans(state)) {
      const currentURL =
        typeof state.data.newCredentialUrl === "string" &&
        state.data.newCredentialUrl.length
          ? state.data.newCredentialUrl
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
          input = input.trim();
          if (input === "") {
            return Promise.resolve({
              message: "You must enter a valid Server URL.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          input = formatURL(input);
          try {
            // will validate that this is a valid URL
            new URL(input);
          } catch (e) {
            if (!(e instanceof TypeError)) {
              throw e;
            }
            return Promise.resolve({
              message: "Invalid URL.",
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
              message: `Server URL is already assigned to your credential "${existingCredential.name}". Only one credential per unique URL is allowed.`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.newCredentialUrl = formatURL(url.trim());
      return (input: MultiStepInput) => inputCredentialName(input, state);
    }
    return inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step #4 - maybe?:
  // Name the credential
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (newCredentialByAnyMeans(state)) {
      const currentName =
        typeof state.data.newCredentialName === "string" &&
        state.data.newCredentialName.length
          ? state.data.newCredentialName
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
        validate: (input: string) => {
          input = input.trim();
          if (input === "") {
            return Promise.resolve({
              message: "A credential is required.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          if (credentials.find((credential) => credential.name === input)) {
            return Promise.resolve({
              message:
                "Nickname is already in use. Please enter a unique value.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          if (input === createNewCredentialLabel) {
            return Promise.resolve({
              message:
                "Nickname is reserved for internal use. Please provide another value.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.newCredentialName = name.trim();
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
        typeof state.data.newCredentialApiKey === "string" &&
        state.data.newCredentialApiKey.length
          ? state.data.newCredentialApiKey
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
        prompt: "The API key to be used to authenticate with Posit Connect",
        placeholder: "example: v1cKJzUzYnHP1p5WrAINMump4Sjp5pbq",
        validate: (input: string) => {
          input = input.trim();
          if (input === "") {
            return Promise.resolve({
              message: "An API key is required.",
              severity: InputBoxValidationSeverity.Error,
            });
          }
          const errorMsg = validateApiKey(input);
          if (errorMsg) {
            return Promise.resolve({
              message: errorMsg,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          return Promise.resolve(undefined);
        },
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.newCredentialApiKey = apiKey;
      return (input: MultiStepInput) => inputEntryPointSelection(input, state);
    }
    return inputEntryPointSelection(input, state);
  }

  // ***************************************************************
  // Step #6 - maybe?:
  // Select the config to be used w/ the contentRecord
  // ***************************************************************
  async function inputEntryPointSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (entryPointListItems.length > 1) {
      const step = getStepInfo("inputEntryPointSelection", state);
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
  // Step #7
  // Name the configuration
  // ***************************************************************
  async function inputTitle(input: MultiStepInput, state: MultiStepState) {
    const step = getStepInfo("inputTitle", state);
    if (!step) {
      throw new Error("newDeployment::inputTitle step info not found.");
    }
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
      title: state.title,
      step: step.step,
      totalSteps: step.totalSteps,
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
      state.data.newCredentialUrl === undefined ||
      isQuickPickItem(state.data.newCredentialUrl) ||
      state.data.newCredentialName === undefined ||
      isQuickPickItem(state.data.newCredentialName) ||
      state.data.newCredentialApiKey === undefined ||
      isQuickPickItem(state.data.newCredentialApiKey)
    ) {
      throw new Error("NewDeployment Unexpected type guard failure @1");
    }
    try {
      // NEED an credential to be returned from this API
      // and assigned to newOrExistingCredential
      const response = await api.credentials.create(
        state.data.newCredentialName,
        state.data.newCredentialUrl,
        state.data.newCredentialApiKey,
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
  try {
    configName = await untitledConfigurationName();
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
    state.data.newCredentialName &&
    !isQuickPickItem(state.data.newCredentialName)
  ) {
    finalCredentialName = state.data.newCredentialName;
  } else if (!state.data.credentialName) {
    throw new Error("NewDeployment Unexpected type guard failure @3");
  } else if (
    newCredentialSelected(state) &&
    state.data.newCredentialName &&
    !isQuickPickItem(state.data.newCredentialName)
  ) {
    finalCredentialName = state.data.newCredentialName;
  } else if (isQuickPickItem(state.data.credentialName)) {
    finalCredentialName = state.data.credentialName.label;
  }
  if (!finalCredentialName) {
    // should have assigned it by now. Logic error!
    throw new Error("NewDeployment Unexpected type guard failure @4");
  }

  // Create the PrecontentRecord File
  try {
    const response = await api.contentRecords.createNew(
      finalCredentialName,
      configName,
      untitledContentRecordName(contentRecordNames),
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
