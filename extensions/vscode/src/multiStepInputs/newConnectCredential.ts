// Copyright (C) 2025 by Posit Software, PBC.

import {
  AbortError,
  InfoMessageParameters,
  InputStep,
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItemWithIndex,
  isString,
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
  findExistingCredentialByURL,
  fetchSnowflakeConnections,
  inputCredentialNameStep,
  getExistingCredentials,
} from "src/multiStepInputs/common";
import { isConnect, isSnowflake } from "../utils/multiStepHelpers";
import { openConfigurationCommand } from "src/commands";
import { extensionSettings } from "src/extension";
import { formatURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import {
  ConnectAuthTokenActivator,
  TokenAuthResult,
} from "src/auth/ConnectAuthTokenActivator";

enum AuthMethod {
  API_KEY = "apiKey",
  TOKEN = "token",
}

enum AuthMethodName {
  API_KEY = "API Key",
  TOKEN = "Token Authentication",
}

const getAuthMethod = (authMethodName: AuthMethodName) => {
  switch (authMethodName) {
    case AuthMethodName.API_KEY:
      return AuthMethod.API_KEY;
    case AuthMethodName.TOKEN:
      return AuthMethod.TOKEN;
  }
};

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
  let authMethod: AuthMethod = AuthMethod.TOKEN;

  enum step {
    INPUT_SERVER_URL = "inputServerUrl",
    INPUT_API_KEY = "inputAPIKey",
    INPUT_SNOWFLAKE_CONN = "inputSnowflakeConnection",
    INPUT_SNOWFLAKE_API_KEY = "inputSnowflakeAPIKey",
    INPUT_CRED_NAME = "inputCredentialName",
    INPUT_AUTH_METHOD = "inputAuthMethod",
    INPUT_TOKEN = "inputToken",
  }

  const steps: Record<
    step,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [step.INPUT_SERVER_URL]: inputServerUrl,
    [step.INPUT_API_KEY]: inputAPIKey,
    [step.INPUT_SNOWFLAKE_CONN]: inputSnowflakeConnection,
    [step.INPUT_SNOWFLAKE_API_KEY]: inputSnowflakeAPIKey,
    [step.INPUT_CRED_NAME]: inputCredentialName,
    [step.INPUT_AUTH_METHOD]: inputAuthMethod,
    [step.INPUT_TOKEN]: inputToken,
  };

  const isToken = (authMethod: AuthMethod) => {
    return authMethod === AuthMethod.TOKEN;
  };

  const isApiKey = (authMethod: AuthMethod) => {
    return authMethod === AuthMethod.API_KEY;
  };

  const isValidTokenAuth = () => {
    // for token authentication, require token and privateKey
    return (
      isConnect(serverType) &&
      isToken(authMethod) &&
      isString(state.data.token) &&
      isString(state.data.privateKey)
    );
  };

  const isValidApiKeyAuth = () => {
    // for API key authentication, require apiKey
    return (
      isConnect(serverType) &&
      isApiKey(authMethod) &&
      isString(state.data.apiKey)
    );
  };

  const isValidSnowflakeAuth = () => {
    // for Snowflake SPCS with OIDC, require both snowflakeConnection and apiKey
    return (
      isSnowflake(serverType) &&
      isString(state.data.snowflakeConnection) &&
      isString(state.data.apiKey)
    );
  };

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
        token: <string | undefined>undefined, // token ID for token authentication
        privateKey: <string | undefined>undefined, // private key for token authentication
      },
      promptStepNumbers: {},
      isValid: () => {
        return (
          isString(state.data.name) &&
          isString(state.data.url) &&
          (isValidApiKeyAuth() || isValidTokenAuth() || isValidSnowflakeAuth())
        );
      },
    };

    await MultiStepInput.run(
      {
        name: step.INPUT_SERVER_URL,
        step: (input) => steps[step.INPUT_SERVER_URL](input, state),
      },
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
        name: step.INPUT_SNOWFLAKE_CONN,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_SNOWFLAKE_CONN](input, state),
      };
    }

    return {
      name: step.INPUT_AUTH_METHOD,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_AUTH_METHOD](input, state),
    };
  }

  // ***************************************************************
  // Step: Select authentication method (Connect only)
  // ***************************************************************
  async function inputAuthMethod(input: MultiStepInput, state: MultiStepState) {
    const authMethods = [
      {
        label: AuthMethodName.TOKEN,
        description: "Recommended - one click connection",
      },
      {
        label: AuthMethodName.API_KEY,
        description: "Manually enter an API key",
      },
    ];

    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: 0,
      placeholder: "Select authentication method",
      items: authMethods,
      activeItem: authMethods[0], // Token authentication is default
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    authMethod = getAuthMethod(pick.label as AuthMethodName);

    if (isApiKey(authMethod)) {
      return {
        name: step.INPUT_API_KEY,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_API_KEY](input, state),
      };
    }

    return {
      name: step.INPUT_TOKEN,
      step: (input: MultiStepInput) => steps[step.INPUT_TOKEN](input, state),
      skipStepHistory: true,
    };
  }

  // ***************************************************************
  // Step: Generate and claim token (Connect only)
  // ***************************************************************
  async function inputToken(input: MultiStepInput, state: MultiStepState) {
    // url should always be defined by the time we get to this step
    const serverUrl = typeof state.data.url === "string" ? state.data.url : "";

    try {
      // Create and initialize the token activator
      const tokenActivator = new ConnectAuthTokenActivator(serverUrl, viewId);
      await tokenActivator.initialize();

      const resp = await input.showInfoMessage<
        TokenAuthResult,
        InfoMessageParameters<TokenAuthResult>
      >({
        title: state.title,
        step: 0,
        totalSteps: 0,
        enabled: false,
        busy: true,
        value: `Authenticating with ${state.data.url}`,
        valueSelection: [0, 0],
        validationMessage: {
          message:
            "Please follow the steps in your browser or 'Escape' to cancel",
          severity: InputBoxValidationSeverity.Info,
        },
        prompt: "",
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
        apiFunction: async () => ({
          data: await tokenActivator.activateToken(),
          intervalAdjustment: 0,
        }),
        exitPollingCondition: (r) => Boolean(r.data),
      });

      // Store token and private key in state
      state.data.token = resp.data?.token;
      state.data.privateKey = resp.data?.privateKey;
    } catch (_e) {
      // Error handling is done within the ConnectAuthTokenActivator
      return;
    }

    return {
      name: step.INPUT_CRED_NAME,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_CRED_NAME](input, state),
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
      name: step.INPUT_CRED_NAME,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_CRED_NAME](input, state),
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
      name: step.INPUT_SNOWFLAKE_API_KEY,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_SNOWFLAKE_API_KEY](input, state),
    };
  }

  // ***************************************************************
  // Step: Enter the API Key for Snowflake SPCS (Snowflake only)
  // ***************************************************************
  async function inputSnowflakeAPIKey(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const currentAPIKey =
      typeof state.data.apiKey === "string" ? state.data.apiKey : "";

    const resp = await input.showInputBox({
      title: state.title,
      step: 0,
      totalSteps: 0,
      password: true,
      value: currentAPIKey,
      prompt: `The Posit Connect API key for Snowflake SPCS OIDC authentication.
        This is required in addition to the Snowflake connection for authentication with Connect deployed in Snowflake SPCS.`,
      validate: (input: string) => {
        if (input.includes(" ")) {
          return Promise.resolve({
            message: "Error: Invalid API Key (spaces are not allowed).",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      finalValidation: (input: string) => {
        // validate that the API key is formed correctly
        const errorMsg = checkSyntaxApiKey(input);
        if (errorMsg) {
          return Promise.resolve({
            message: `Error: Invalid API Key (${errorMsg}).`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.apiKey = resp.trim();

    return {
      name: step.INPUT_CRED_NAME,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_CRED_NAME](input, state),
    };
  }

  // ***************************************************************
  // Step: Name the credential (used for all platforms)
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    if (!state.data.name && typeof state.data.url === "string") {
      try {
        const url = new URL(state.data.url);
        state.data.name = url.hostname;
      } catch {
        // If URL parsing fails, leave name unchanged
      }
    }

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

  // make sure user has not hit escape or moved away from the window
  // before completing the steps
  if (!state.isValid()) {
    console.log("User has dismissed the New Connect Credential flow. Exiting.");
    // it is necessary to throw here because this can be part of a
    // sub-flow and we need to identify when the user has abandoned this
    // flow (could be history backwards navigation) so we don't override
    // valid data with undefined in the parent flow since promises are
    // async in nature and resolve in unpredictible order specially when
    // navigating backwards and then forward in the multi-stepper steps
    throw new AbortError();
  }

  // create the credential!
  let credential: Credential | undefined = undefined;
  try {
    const resp = await api.credentials.connectCreate(state.data, serverType);
    credential = resp.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return credential;
}
