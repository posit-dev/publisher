// Copyright (C) 2025 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItem,
  isQuickPickItemWithIndex,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, window } from "vscode";

import {
  useApi,
  Credential,
  SnowflakeConnection,
  ServerType,
  PlatformName,
} from "src/api";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { formatURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { showProgress } from "src/utils/progress";
import { openConfigurationCommand } from "src/commands";
import { extensionSettings } from "src/extension";
import {
  findExistingCredentialByURL,
  fetchSnowflakeConnections,
  platformList,
  isConnect,
  isSnowflake,
} from "src/multiStepInputs/common";
import { getEnumKeyByEnumValue } from "src/utils/enums";

const createNewCredentialLabel = "Create a New Credential";

export async function newCredential(
  viewId: string,
  startingServerUrl?: string,
): Promise<string | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let credentials: Credential[] = [];

  // the serverType & platformName will be overwritten in the very first step
  // when the platform selector is introduced
  let serverType: ServerType = ServerType.CONNECT;
  let platformName: PlatformName = PlatformName.CONNECT;
  let connections: SnowflakeConnection[] = [];
  let connectionQuickPicks: QuickPickItemWithIndex[];

  const getSnowflakeConnections = async (serverUrl: string) => {
    const sfc = await fetchSnowflakeConnections(serverUrl);
    connections = sfc.connections;
    connectionQuickPicks = sfc.connectionQuickPicks;
  };

  // ***************************************************************
  // Order of all steps
  // ***************************************************************

  // Get the server url
  // Get the API key for Connect OR get the Snowflake connection name
  // Get the credential name
  // result in calling credential API

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Create a New Credential",
      // We're going to disable displaying the steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been canceled
        url: startingServerUrl, // eventual type is string
        apiKey: <string | undefined>undefined, // eventual type is string
        name: <string | undefined>undefined, // eventual type is string
        snowflakeConnection: <string | undefined>undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    await MultiStepInput.run((input) => inputPlatform(input, state));
    return state;
  }

  // ***************************************************************
  // Step: Select the platform for the credentials (used for all platforms)
  // ***************************************************************
  async function inputPlatform(input: MultiStepInput, state: MultiStepState) {
    // skip platform selection unless the enableConnectCloud config has been turned on
    if (extensionSettings.enableConnectCloud()) {
      const pick = await input.showQuickPick({
        title: state.title,
        step: 0,
        totalSteps: 0,
        placeholder: "Please select the platform for the new credential.",
        items: platformList,
        buttons: [],
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
      });

      const enumKey = getEnumKeyByEnumValue(PlatformName, pick.label);
      // fallback to CONNECT if there is ever a case when the enumKey is not found
      serverType = enumKey ? ServerType[enumKey] : ServerType.CONNECT;
      platformName = pick.label as PlatformName;

      return (input: MultiStepInput) => inputServerUrl(input, state);
    }

    // default to CONNECT, since there are no other products at the moment
    serverType = ServerType.CONNECT;
    platformName = PlatformName.CONNECT;

    return (input: MultiStepInput) => inputServerUrl(input, state);
  }

  // ***************************************************************
  // Step: Get the server url (used for Connect & Snowflake)
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    let currentURL =
      typeof state.data.url === "string" && state.data.url.length
        ? state.data.url
        : "";

    if (currentURL === "") {
      currentURL = await extensionSettings.defaultConnectServer();
    }

    // Two credentials for the same URL is not allowed so clear the default if one is found
    if (
      currentURL !== "" &&
      findExistingCredentialByURL(credentials, currentURL)
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
              message: `Unexpected error within NewCredential::inputSeverUrl.finalValidation: ${JSON.stringify(e)}`,
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
          const err = testResult.data.error;
          if (err) {
            if (err.code === "errorCertificateVerification") {
              return Promise.resolve({
                message: `Error: URL Not Accessible - ${err.msg}. If applicable, consider disabling [Verify TLS Certificates](${openConfigurationCommand}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
            return Promise.resolve({
              message: `Error: Invalid URL (unable to validate connectivity with Server URL - ${getMessageFromError(err)}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }

          if (testResult.data.serverType) {
            // serverType will be overwritten if it is snowflake
            serverType = testResult.data.serverType;
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

    if (isConnect(serverType)) {
      return (input: MultiStepInput) => inputAPIKey(input, state);
    }

    if (isSnowflake(serverType)) {
      return (input: MultiStepInput) => inputSnowflakeConnection(input, state);
    }

    // Should not land here since the platform is forcefully picked in the very first step
    return Promise.resolve(undefined);
  }

  // ***************************************************************
  // Step: Enter the API Key (Connect only)
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    const currentAPIKey =
      typeof state.data.apiKey === "string" && state.data.apiKey.length
        ? state.data.apiKey
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
        // validate that the API key is formed correctly
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

    // only one of api key and snowflake connection should be configured
    state.data.apiKey = apiKey;
    state.data.snowflakeConnection = "";
    state.data.url = validatedURL;
    return (input: MultiStepInput) => inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step: Enter the Snowflake connection name (Snowflake only)
  // ***************************************************************
  async function inputSnowflakeConnection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    // url should always be defined by the time we get to this step
    // but we have to type guard it for the API
    const serverUrl = typeof state.data.url === "string" ? state.data.url : "";

    try {
      await showProgress(
        "Reading Snowflake connections",
        viewId,
        async () => await getSnowflakeConnections(serverUrl),
      );
    } catch {
      // errors have already been displayed by getSnowflakeConnections
      return;
    }

    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: 0,
      placeholder: "Select the Snowflake connection to use for authentication.",
      items: connectionQuickPicks,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    if (!pick || !isQuickPickItemWithIndex(pick)) {
      return;
    }

    // only one of api key and snowflake connection should be configured
    state.data.apiKey = "";
    state.data.snowflakeConnection = connections[pick.index].name;
    state.data.url = connections[pick.index].serverUrl;
    return (input: MultiStepInput) => inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step: Name the credential (used for all platforms)
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const currentName =
      typeof state.data.name === "string" && state.data.name.length
        ? state.data.name
        : "";

    const name = await input.showInputBox({
      title: state.title,
      step: 0,
      totalSteps: 0,
      value: currentName,
      prompt: "Enter a unique nickname for this server.",
      placeholder: `${platformName}`,
      finalValidation: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "Error: Invalid Nickname (a value is required).",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        if (credentials.find((cred) => cred.name === input)) {
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

    // last step to create a new credential
  }

  // ***************************************************************
  // Wait for the api promise to complete while showing progress
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************
  try {
    await showProgress("Initializing::newCredential", viewId, async () => {
      const response = await api.credentials.list();
      credentials = response.data;
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError(
      "newCredentials, credentials.list",
      error,
    );
    window.showInformationMessage(
      `Unable to query existing credentials. ${summary}`,
    );
  }

  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
    state.data.url === undefined ||
    isQuickPickItem(state.data.url) ||
    state.data.apiKey === undefined ||
    isQuickPickItem(state.data.apiKey) ||
    state.data.snowflakeConnection === undefined ||
    isQuickPickItem(state.data.snowflakeConnection) ||
    state.data.name === undefined ||
    isQuickPickItem(state.data.name)
  ) {
    return;
  }

  // create the credential!
  try {
    const api = await useApi();
    await api.credentials.create(
      state.data.name,
      state.data.url,
      state.data.apiKey,
      state.data.snowflakeConnection,
      serverType,
    );
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return state.data.name;
}
