// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
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
  AccountAuthType,
  useApi,
  ConfigurationDetails,
  isConfigurationError,
  Account,
  Configuration,
  PreDeployment,
  ServerType,
  AccountSource,
} from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  untitledConfigurationName,
  untitledDeploymentName,
} from "src/utils/names";
import { isValidFilename } from "src/utils/files";
import { formatURL, normalizeURL } from "src/utils/url";
import { validateApiKey } from "src/utils/apiKeys";
import { DestinationObjects } from "src/types/shared";

export async function newDestination(
  viewId?: string,
): Promise<DestinationObjects | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();

  let accounts: Account[] = [];
  let accountListItems: QuickPickItem[] = [];

  let entryPointLabels: string[] = [];
  let entryPointListItems: QuickPickItem[] = [];
  const entryPointLabelMap = new Map<string, ConfigurationDetails>();
  let configDetails: ConfigurationDetails[] = [];
  let configFileNames: string[] = [];
  let deploymentNames: string[] = [];

  let newConfig: Configuration | undefined;
  let newOrSelectedCredential: Account | undefined;
  let newDeployment: PreDeployment | undefined;

  const createNewCredentialLabel = "Create a New Credential";

  const creatingNewCredential = (state: MultiStepState) => {
    return (
      state.data.credentialName &&
      isQuickPickItem(state.data.credentialName) &&
      state.data.credentialName.label === createNewCredentialLabel
    );
  };

  const getAccounts = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.accounts.getAll();
      accounts = response.data;
      accountListItems = accounts.map((account) => ({
        iconPath: new ThemeIcon("account"),
        label: account.name,
        description: account.source,
        detail:
          account.authType === AccountAuthType.API_KEY
            ? "Using API Key"
            : account.accountName
              ? `Using Token Auth for ${account.accountName}`
              : `Using Token Auth`,
      }));
      accountListItems.push({
        iconPath: new ThemeIcon("plus"),
        label: createNewCredentialLabel,
        detail: "Select this option to create a destination to a new server",
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "initWorkspace, accounts.getAll",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with a failed API response. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  const getEntryPoints = new Promise<void>(async (resolve, reject) => {
    try {
      const inspectResponse = await api.configurations.inspect();
      configDetails = inspectResponse.data;
      entryPointLabels = configDetails.map((config) => `${config.entrypoint}`);
      configDetails.forEach((config) => {
        if (config.entrypoint) {
          entryPointListItems.push({
            iconPath: new ThemeIcon("file"),
            label: config.entrypoint,
            description: `(type ${config.type})`,
          });
        }
      });
      for (let i = 0; i < configDetails.length; i++) {
        entryPointLabelMap.set(entryPointLabels[i], configDetails[i]);
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "initWorkspace, configurations.inspect",
        error,
      );
      window.showErrorMessage(
        `Unable to continue with project inspection failure. ${summary}`,
      );
      return reject();
    }
    if (!entryPointListItems.length) {
      window.showErrorMessage(
        `Unable to continue with no project entrypoints found during inspection`,
      );
      return reject();
    }
    return resolve();
  });

  const getConfigurations = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.configurations.getAll();
      const configurations = response.data;

      configurations.forEach((configuration) => {
        if (!isConfigurationError(configuration)) {
          configFileNames.push(configuration.configurationName);
        }
      });
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, configurations.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to continue with configuration API Error. ${summary}`,
      );
      return reject();
    }
    resolve();
  });

  const getDeployments = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.deployments.getAll();
      const deploymentList = response.data;
      // Note.. we want all of the deployment filenames regardless if they are valid or not.
      deploymentNames = deploymentList.map(
        (deployment) => deployment.deploymentName,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newDeployment, deployments.getAll",
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
    getAccounts,
    getEntryPoints,
    getConfigurations,
    getDeployments,
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

  // Name the deployment
  // If no credentials, then skip to create new credential
  // If some credentials, select either use of existing or creation of a new one
  // If creating credential:
  // - Get the server url
  // - Get the credential nickname
  // - Get the API key
  // Select the entrypoint, if there is more than one
  // Name the config file to use
  // Prompt if want to continue with creation
  // Call APIs and hopefully succeed at everything
  // Return the names of the deployment, config and credentials

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Create a New Destination",
      // We're going to temporarily disable display of steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled to assist type guards
        deploymentName: undefined, // eventual type is string
        credentialName: undefined, // eventual type is either a string or QuickPickItem
        newCredentialUrl: undefined, // eventual type is string
        newCredentialName: undefined, // eventual type is string
        newCredentialApiKey: undefined, // eventual type is string
        entryPoint: undefined, // eventual type is QuickPickItem
        configFileName: undefined, // eventual type is string
        promptToCreateDestination: undefined, // eventual type is QuickPickItem
      },
      promptStepNumbers: {},
    };

    // start the progression through the steps

    await MultiStepInput.run((input) => inputDeploymentName(input, state));
    return state as MultiStepState;
  }

  // ***************************************************************
  // Step #1:
  // Name the deployment file
  // ***************************************************************
  async function inputDeploymentName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const deploymentName = await input.showInputBox({
      title: state.title,
      step: 0,
      totalSteps: state.totalSteps,
      value:
        typeof state.data.deploymentName === "string" &&
        state.data.deploymentName.length
          ? state.data.deploymentName
          : untitledDeploymentName(deploymentNames),
      prompt: "Choose a unique name for the deployment",
      validate: (value) => {
        if (value.length < 3 || !isValidFilename(value)) {
          return Promise.resolve({
            message: `Invalid Name: Value must be longer than 3 characters, cannot be '.' or contain '..' or any of these characters: /:*?"<>|\\`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        if (deploymentNames.includes(value)) {
          return Promise.resolve({
            message: `Invalid Name: Value is already in use by a deployment file.`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.deploymentName = deploymentName;
    return (input: MultiStepInput) => pickCredentials(input, state);
  }

  // ***************************************************************
  // Step #2:
  // Select the credentials to be used
  // ***************************************************************
  async function pickCredentials(input: MultiStepInput, state: MultiStepState) {
    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: state.totalSteps,
      placeholder:
        "Select the credential you want to use to deploy. (Use this field to filter selections.)",
      items: accountListItems,
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

  // ***************************************************************
  // Step #3 - maybe?:
  // Get the server url
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    if (creatingNewCredential(state)) {
      const currentURL =
        typeof state.data.newCredentialUrl === "string" &&
        state.data.newCredentialUrl.length
          ? state.data.newCredentialUrl
          : "";

      const url = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: state.totalSteps,
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
          const existingAccount = accounts.find(
            (account) =>
              normalizeURL(input).toLowerCase() ===
              normalizeURL(account.url).toLowerCase(),
          );
          if (existingAccount) {
            return Promise.resolve({
              message: `Server URL is already assigned to your credential "${existingAccount.name}". Only one credential per unique URL is allowed.`,
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
    if (creatingNewCredential(state)) {
      const currentName =
        typeof state.data.newCredentialName === "string" &&
        state.data.newCredentialName.length
          ? state.data.newCredentialName
          : "";

      const name = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: state.totalSteps,
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
          if (accounts.find((account) => account.name === input)) {
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
    if (creatingNewCredential(state)) {
      const currentAPIKey =
        typeof state.data.newCredentialApiKey === "string" &&
        state.data.newCredentialApiKey.length
          ? state.data.newCredentialApiKey
          : "";

      const apiKey = await input.showInputBox({
        title: state.title,
        step: 0,
        totalSteps: state.totalSteps,
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
  // Select the config to be used w/ the deployment
  // ***************************************************************
  async function inputEntryPointSelection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // skip if we only have one choice.
    if (entryPointListItems.length > 1) {
      const pick = await input.showQuickPick({
        title: state.title,
        step: 0,
        totalSteps: state.totalSteps,
        placeholder:
          "Select main file and content type below. (Use this field to filter selections.)",
        items: entryPointListItems,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      state.data.entryPoint = pick;
      return (input: MultiStepInput) => inputConfigurationName(input, state);
    } else {
      state.data.entryPoint = entryPointListItems[0];
      // We're skipping this step, so we must silently just jump to the next step
      return inputConfigurationName(input, state);
    }
  }

  // ***************************************************************
  // Step #7 - maybe:
  // Name the configuration
  // ***************************************************************
  async function inputConfigurationName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const configFileName = await input.showInputBox({
      title: state.title,
      step: 0,
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
      ignoreFocusOut: true,
    });

    state.data.configFileName = configFileName;
    return (input: MultiStepInput) => promptToCreateDestination(input, state);
  }

  // ***************************************************************
  // Step #8 - maybe:
  // Does the user want to continue creating this destination
  // ***************************************************************
  async function promptToCreateDestination(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: state.totalSteps,
      placeholder:
        "Do you still wish to create the destination? (Use this field to filter selections.)",
      items: [
        {
          label: "Yes",
          description: "Proceed with creation of a new destination",
        },
        {
          label: "No",
          description: "Abort this process and create nothing",
        },
      ],
      activeItem:
        typeof state.data.promptToCreateDestination !== "string"
          ? state.data.promptToCreateDestination
          : undefined,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });
    state.data.promptToCreateDestination = pick;
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
    state.data.deploymentName === undefined ||
    typeof state.data.deploymentName !== "string" ||
    state.data.credentialName === undefined ||
    // credentialName can be either type
    state.data.entryPoint === undefined ||
    !isQuickPickItem(state.data.entryPoint) ||
    state.data.configFileName === undefined ||
    typeof state.data.configFileName !== "string" ||
    state.data.promptToCreateDestination === undefined ||
    !isQuickPickItem(state.data.promptToCreateDestination)
  ) {
    return;
  }

  if (state.data.promptToCreateDestination.label !== "Yes") {
    return;
  }

  // Maybe create a new credential?
  if (creatingNewCredential(state)) {
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
      return;
    }
    try {
      const api = await useApi();
      // NEED an account to be returned from this API
      // and assigned to newOrExistingCredential
      await api.credentials.createOrUpdate({
        name: state.data.newCredentialName,
        url: state.data.newCredentialUrl,
        apiKey: state.data.newCredentialApiKey,
      });
      // This will be replaced with the API change
      newOrSelectedCredential = {
        name: state.data.newCredentialName,
        url: state.data.newCredentialUrl,
        type: ServerType.CONNECT,
        authType: AccountAuthType.API_KEY,
        accountName: "",
        caCert: "",
        insecure: false,
        source: AccountSource.KEYCHAIN,
      };
    } catch (error: unknown) {
      const summary = getSummaryStringFromError("credentials::add", error);
      window.showInformationMessage(summary);
    }
  } else {
    // If not creating, then we need to retrieve the one we're using.
    let targetName: string | undefined = undefined;
    if (isQuickPickItem(state.data.credentialName)) {
      targetName = state.data.credentialName.label;
    }
    if (targetName) {
      newOrSelectedCredential = accounts.find(
        (account) => account.name === targetName,
      );
    }
  }

  // Create the Config File
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
    const fileUri = Uri.file(createResponse.data.configurationPath);
    newConfig = createResponse.data;
    await commands.executeCommand("vscode.open", fileUri);
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDestination, configurations.createOrUpdate",
      error,
    );
    window.showErrorMessage(`Failed to create config file. ${summary}`);
    return;
  }

  let finalCredentialName = <string | undefined>undefined;
  if (
    creatingNewCredential(state) &&
    state.data.newCredentialName &&
    !isQuickPickItem(state.data.newCredentialName)
  ) {
    finalCredentialName = state.data.newCredentialName;
  } else if (isQuickPickItem(state.data.credentialName)) {
    finalCredentialName = state.data.credentialName.label;
  }
  if (!finalCredentialName) {
    return;
  }

  // Create the Predeployment File
  try {
    const response = await api.deployments.createNew(
      finalCredentialName,
      state.data.configFileName,
      state.data.deploymentName,
    );
    newDeployment = response.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newDestination, deployments.createNew",
      error,
    );
    window.showErrorMessage(`Failed to create pre-deployment file. ${summary}`);
    return;
  }
  if (!newOrSelectedCredential) {
    return;
  }
  return {
    deployment: newDeployment,
    configuration: newConfig,
    credential: newOrSelectedCredential,
  };
}
