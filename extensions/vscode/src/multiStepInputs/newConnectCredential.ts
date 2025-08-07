// Copyright (C) 2025 by Posit Software, PBC.

import {
  AbortError,
  InputStep,
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
  ServerType,
  ProductName,
  SnowflakeConnection,
} from "src/api";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { showProgress } from "src/utils/progress";
import {
  isConnect,
  isSnowflake,
  findExistingCredentialByURL,
  fetchSnowflakeConnections,
  inputCredentialNameStep,
  getExistingCredentials,
} from "src/multiStepInputs/common";
import { openConfigurationCommand } from "src/commands";
import { extensionSettings } from "src/extension";
import { formatURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";

export async function newConnectCredential(
  viewId: string,
  viewTitle: string,
  startingServerUrl?: string,
  previousSteps?: InputStep[],
): Promise<Credential | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let credentials: Credential[] = [];

  // globals
  let serverType: ServerType = ServerType.CONNECT;
  const productName: ProductName = ProductName.CONNECT;

  // ***************************************************************
  // Order of all steps for creating a new Connect credential
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
      title: viewTitle,
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

    await MultiStepInput.run(
      { step: (input) => inputServerUrl(input, state) },
      previousSteps,
    );
    return state;
  }

  // ***************************************************************
  // Step: Get the server url (used for Connect & Snowflake)
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    let currentURL = typeof state.data.url === "string" ? state.data.url : "";

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

    const resp = await input.showInputBox({
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

    state.data.url = formatURL(resp.trim());

    if (isSnowflake(serverType)) {
      return {
        step: (input: MultiStepInput) => inputSnowflakeConnection(input, state),
      };
    }

    return {
      step: (input: MultiStepInput) => inputAPIKey(input, state),
    };
  }

  // ***************************************************************
  // Step: Enter the API Key (Connect only)
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    const currentAPIKey =
      typeof state.data.apiKey === "string" ? state.data.apiKey : "";

    const resp = await input.showInputBox({
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
            state.data.url = testResult.data.url;
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

    state.data.apiKey = resp;

    return {
      step: (input: MultiStepInput) => inputCredentialName(input, state),
    };
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
    let connections: SnowflakeConnection[] = [];
    let connectionQuickPicks: QuickPickItemWithIndex[] = [];

    try {
      await showProgress("Reading Snowflake connections", viewId, async () => {
        const resp = await fetchSnowflakeConnections(serverUrl);
        connections = resp.connections;
        connectionQuickPicks = resp.connectionQuickPicks;
      });
    } catch {
      // errors have already been displayed by fetchSnowflakeConnections
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

    state.data.snowflakeConnection = connections[pick.index].name;
    state.data.url = connections[pick.index].serverUrl;

    return {
      step: (input: MultiStepInput) => inputCredentialName(input, state),
    };
  }

  // ***************************************************************
  // Step: Name the credential (used for all platforms)
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    state.data.name = await inputCredentialNameStep(
      input,
      state,
      serverType,
      productName,
      credentials,
    );

    // last step to create a new credential
  }

  // ***************************************************************
  // Get the list of existing credentials while showing progress.
  // Kick off the input collection and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************
  credentials = await getExistingCredentials(viewId);
  const state = await collectInputs();

  const isMissingConnectStateData = (state: MultiStepState) => {
    // either the apiKey or the snowflakeConnection must be specified
    return (
      (isConnect(serverType) &&
        (state.data.apiKey === undefined ||
          isQuickPickItem(state.data.apiKey))) ||
      (isSnowflake(serverType) &&
        (state.data.snowflakeConnection === undefined ||
          isQuickPickItem(state.data.snowflakeConnection)))
    );
  };

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
    state.data.name === undefined ||
    isQuickPickItem(state.data.name) ||
    state.data.url === undefined ||
    isQuickPickItem(state.data.url) ||
    isMissingConnectStateData(state)
  ) {
    console.log("User has dismissed the New Connect Credential flow. Exiting.");
    throw new AbortError();
  }

  // default anything that hasn't been initialized in the state
  const { apiKey, snowflakeConnection } = state.data;
  state.data.apiKey = typeof apiKey !== "string" ? "" : apiKey;
  state.data.snowflakeConnection =
    typeof snowflakeConnection !== "string" ? "" : snowflakeConnection;

  // create the credential!
  let credential: Credential | undefined = undefined;
  try {
    const resp = await api.credentials.create(
      state.data.name,
      state.data.url,
      state.data.apiKey,
      state.data.snowflakeConnection,
      "",
      "",
      "",
      "",
      serverType,
    );
    credential = resp.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return credential;
}
