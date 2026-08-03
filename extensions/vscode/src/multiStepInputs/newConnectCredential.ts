// Copyright (C) 2025 by Posit Software, PBC.

import {
  AbortError,
  InfoMessageParameters,
  InputStep,
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isCancellation,
  isQuickPickItemWithIndex,
  isString,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, window } from "vscode";

import { Credential, ServerType, ProductName } from "src/api";
import type { SnowflakeConnection } from "src/snowflake/types";
import {
  describeError,
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
import { CredentialsService } from "src/credentials/service";
import { isConnect, isSnowflake } from "../utils/multiStepHelpers";
import { listConnections } from "src/snowflake/connections";
import { openConfigurationCommand } from "src/commands";
import { extensionSettings } from "src/extension";
import { formatURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { testServerURL, testAuthentication } from "src/utils/testCredentials";
import {
  ConnectAuthTokenActivator,
  TokenAuthResult,
} from "src/auth/ConnectAuthTokenActivator";
import {
  ConnectOAuthActivator,
  discoverOAuthMetadata,
  OAuthAuthResult,
  OAuthMetadata,
} from "src/auth/oauth";
import { logger } from "src/logging";

// Internal auth mechanisms. OAUTH and TOKEN are both surfaced to the user as a
// single "sign in with a browser" choice — the user never sees a token, so the
// distinction is an implementation detail resolved by whether the server
// advertises OAuth.
enum AuthMethod {
  API_KEY = "apiKey",
  TOKEN = "token",
  OAUTH = "oauth",
}

enum AuthMethodName {
  API_KEY = "API Key",
  BROWSER = "Sign in with a browser",
}

export async function newConnectCredential(
  viewId: string,
  viewTitle: string,
  credentialsService: CredentialsService,
  startingServerUrl?: string,
  previousSteps?: InputStep[],
  // When set, skips the auth-method picker and goes straight to that method
  // (e.g. the addCredential agent tool inferred "browser sign-in" from a
  // supplied server URL, or the caller explicitly asked for an API key).
  authMethodHint?: "browser" | "apiKey",
): Promise<Credential | undefined> {
  let credentials: Credential[] = [];

  // globals
  let serverType: ServerType = ServerType.CONNECT;
  const productName: ProductName = ProductName.CONNECT;
  let authMethod: AuthMethod = AuthMethod.TOKEN;
  // OAuth metadata discovered for the entered server (null when unsupported).
  let oauthMetadata: OAuthMetadata | null = null;

  enum step {
    INPUT_SERVER_URL = "inputServerUrl",
    INPUT_API_KEY = "inputAPIKey",
    INPUT_SNOWFLAKE_CONN = "inputSnowflakeConnection",
    INPUT_CRED_NAME = "inputCredentialName",
    INPUT_AUTH_METHOD = "inputAuthMethod",
    INPUT_TOKEN = "inputToken",
    INPUT_OAUTH = "inputOAuth",
  }

  const steps: Record<
    step,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [step.INPUT_SERVER_URL]: inputServerUrl,
    [step.INPUT_API_KEY]: inputAPIKey,
    [step.INPUT_SNOWFLAKE_CONN]: inputSnowflakeConnection,
    [step.INPUT_CRED_NAME]: inputCredentialName,
    [step.INPUT_AUTH_METHOD]: inputAuthMethod,
    [step.INPUT_TOKEN]: inputToken,
    [step.INPUT_OAUTH]: inputOAuth,
  };

  const isToken = (authMethod: AuthMethod) => {
    return authMethod === AuthMethod.TOKEN;
  };

  const isApiKey = (authMethod: AuthMethod) => {
    return authMethod === AuthMethod.API_KEY;
  };

  async function getSnowflakeToken(
    state: MultiStepState,
  ): Promise<string | undefined> {
    const connName = state.data.snowflakeConnection;
    if (!isSnowflake(serverType) || typeof connName !== "string") {
      return undefined;
    }
    const connections = listConnections();
    const config = connections[connName];
    if (!config) {
      return undefined;
    }
    return await credentialsService.getSnowflakeToken(config);
  }

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
    return (
      isSnowflake(serverType) &&
      isString(state.data.snowflakeConnection) &&
      (isString(state.data.apiKey) ||
        (isString(state.data.token) && isString(state.data.privateKey)))
    );
  };

  const isValidOAuth = () => {
    // OAuth requires a registered client id and an access token.
    return (
      isConnect(serverType) &&
      isString(state.data.oauthClientId) &&
      isString(state.data.accessToken)
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
        oauthClientId: <string | undefined>undefined, // OAuth dynamic-client-registration id
        accessToken: <string | undefined>undefined, // OAuth access token
        refreshToken: <string | undefined>undefined, // OAuth refresh token
        tokenExpiresAt: <string | undefined>undefined, // OAuth access-token expiry (ISO)
      },
      promptStepNumbers: {},
      isValid: () => {
        return (
          isString(state.data.name) &&
          isString(state.data.url) &&
          (isValidApiKeyAuth() ||
            isValidTokenAuth() ||
            isValidSnowflakeAuth() ||
            isValidOAuth())
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
          const testResult = await testServerURL({
            url: input,
            insecure: !extensionSettings.verifyCertificates(),
          });
          if (testResult.error) {
            if (testResult.error.code === "errorCertificateVerification") {
              return Promise.resolve({
                message: `Error: URL Not Accessible - ${testResult.error.msg}. If applicable, consider disabling [Verify TLS Certificates](${openConfigurationCommand}).`,
                severity: InputBoxValidationSeverity.Error,
              });
            }
            return Promise.resolve({
              message: `Error: Invalid URL (unable to validate connectivity with Server URL - ${getMessageFromError(testResult.error)}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }

          if (testResult.serverType) {
            // serverType will be overwritten if it is snowflake
            serverType = testResult.serverType;
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

    // Probe for OAuth support (RFC 8414) so the auth-method step can offer it
    // (as the recommended option) when the server advertises it.
    const serverUrl = typeof state.data.url === "string" ? state.data.url : "";
    oauthMetadata = await showProgress(
      "Checking authentication options",
      viewId,
      () =>
        discoverOAuthMetadata(
          serverUrl,
          !extensionSettings.verifyCertificates(),
        ),
    );

    // Skip the picker when the caller already knows what to do.
    if (authMethodHint) {
      return dispatchAuthMethod(authMethodHint, state);
    }

    return {
      name: step.INPUT_AUTH_METHOD,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_AUTH_METHOD](input, state),
    };
  }

  // ***************************************************************
  // Resolve a chosen auth method (from the picker, or a caller-supplied
  // hint) into the next step. Also clears fields from other methods so
  // back-navigation can't leave a credential with mixed material.
  // ***************************************************************
  function dispatchAuthMethod(
    choice: "browser" | "apiKey",
    state: MultiStepState,
  ): InputStep {
    const clearOAuth = () => {
      state.data.oauthClientId = undefined;
      state.data.accessToken = undefined;
      state.data.refreshToken = undefined;
      state.data.tokenExpiresAt = undefined;
    };
    const clearToken = () => {
      state.data.token = undefined;
      state.data.privateKey = undefined;
    };

    if (choice === "apiKey") {
      authMethod = AuthMethod.API_KEY;
      clearToken();
      clearOAuth();
      return {
        name: step.INPUT_API_KEY,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_API_KEY](input, state),
      };
    }

    // Browser sign-in: OAuth when supported, else the token flow.
    state.data.apiKey = undefined;
    if (oauthMetadata) {
      authMethod = AuthMethod.OAUTH;
      clearToken();
      return {
        name: step.INPUT_OAUTH,
        step: (input: MultiStepInput) => steps[step.INPUT_OAUTH](input, state),
        skipStepHistory: true,
      };
    }
    authMethod = AuthMethod.TOKEN;
    clearOAuth();
    return {
      name: step.INPUT_TOKEN,
      step: (input: MultiStepInput) => steps[step.INPUT_TOKEN](input, state),
      skipStepHistory: true,
    };
  }

  // ***************************************************************
  // Step: Select authentication method (Connect only)
  // ***************************************************************
  async function inputAuthMethod(input: MultiStepInput, state: MultiStepState) {
    // Two choices, always: a browser sign-in (recommended) and a manual API
    // key. The browser option is OAuth when the server advertises it, otherwise
    // the token flow — both open the browser and never expose a token, so the
    // user sees one consistent "sign in with a browser" option either way.
    const authMethods = [
      {
        label: AuthMethodName.BROWSER,
        description: "Recommended",
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
      // Browser sign-in is the default.
      activeItem: authMethods[0],
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    return dispatchAuthMethod(
      pick.label === AuthMethodName.API_KEY ? "apiKey" : "browser",
      state,
    );
  }

  // ***************************************************************
  // Step: Generate and claim token (Connect only)
  // ***************************************************************
  async function inputToken(input: MultiStepInput, state: MultiStepState) {
    // url should always be defined by the time we get to this step
    const serverUrl = typeof state.data.url === "string" ? state.data.url : "";

    try {
      const snowflakeToken = await getSnowflakeToken(state);

      // Create the token activator
      const tokenActivator = new ConnectAuthTokenActivator(
        serverUrl,
        viewId,
        undefined,
        !extensionSettings.verifyCertificates(),
        snowflakeToken,
      );

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

      // Update the server URL
      state.data.url = resp.data?.serverUrl;
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
  // Step: Sign in with OAuth (Connect only, when the server supports it)
  // ***************************************************************
  async function inputOAuth(input: MultiStepInput, state: MultiStepState) {
    const serverUrl = typeof state.data.url === "string" ? state.data.url : "";

    // Defensive: should only be reached when metadata was discovered.
    if (!oauthMetadata) {
      return {
        name: step.INPUT_AUTH_METHOD,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_AUTH_METHOD](input, state),
      };
    }

    const activator = new ConnectOAuthActivator(
      serverUrl,
      oauthMetadata,
      viewId,
      !extensionSettings.verifyCertificates(),
    );

    try {
      const resp = await input.showInfoMessage<
        OAuthAuthResult,
        InfoMessageParameters<OAuthAuthResult>
      >({
        title: state.title,
        step: 0,
        totalSteps: 0,
        enabled: false,
        busy: true,
        value: `Signing in to ${serverUrl}`,
        valueSelection: [0, 0],
        validationMessage: {
          message:
            "Complete sign-in in your browser, or press 'Escape' to use an API key instead.",
          severity: InputBoxValidationSeverity.Info,
        },
        prompt: "",
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
        apiFunction: async () => ({
          data: await activator.authenticate(),
          intervalAdjustment: 0,
        }),
        exitPollingCondition: (r) => Boolean(r.data),
      });

      state.data.oauthClientId = resp.data?.oauthClientId;
      state.data.accessToken = resp.data?.accessToken;
      state.data.refreshToken = resp.data?.refreshToken;
      state.data.tokenExpiresAt = resp.data?.tokenExpiresAt;

      // Clear any other auth material picked up from a prior path.
      state.data.apiKey = undefined;
      state.data.token = undefined;
      state.data.privateKey = undefined;

      // Leave the credential name for inputCredentialName to default to the
      // server hostname, matching the token-based flow (the user can edit it).
    } catch (e) {
      // A dismissal or an OAuth failure both divert to the manual auth-method
      // chooser so an API key is always reachable. Only a real failure warrants
      // an error popup — see isCancellation for why a dismissal must not take
      // this path.
      if (isCancellation(e)) {
        logger.debug("OAuth sign-in was dismissed before it completed.");
      } else {
        // describeError, not getMessageFromError: the latter returns "" for any
        // throw it doesn't recognize.
        const reason = describeError(e);
        logger.debug(`OAuth sign-in failed: ${reason}`);
        window.showErrorMessage(
          `OAuth sign-in did not complete: ${reason}. You can use an API key instead.`,
        );
      }
      return {
        name: step.INPUT_AUTH_METHOD,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_AUTH_METHOD](input, state),
      };
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
          const snowflakeToken = await getSnowflakeToken(state);
          const testResult = await testAuthentication({
            url: serverUrl,
            apiKey: input,
            snowflakeToken,
            insecure: !extensionSettings.verifyCertificates(),
          });
          if (testResult.error) {
            return Promise.resolve({
              message: `Error: Invalid API Key (${testResult.error.msg}).`,
              severity: InputBoxValidationSeverity.Error,
            });
          }
          // testAuthentication may have discovered a different URL.
          if (testResult.url) {
            state.data.url = testResult.url;
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
        const resp = await fetchSnowflakeConnections(
          credentialsService,
          serverUrl,
        );
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

    const selectedConnection = connections[pick.index];
    if (selectedConnection) {
      state.data.snowflakeConnection = selectedConnection.name;
      state.data.url = selectedConnection.serverUrl;
    }

    return {
      name: step.INPUT_AUTH_METHOD,
      step: (input: MultiStepInput) =>
        steps[step.INPUT_AUTH_METHOD](input, state),
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
        // suggest a default name
        const url = new URL(state.data.url);
        state.data.name = url.hostname;
      } catch {
        // If URL parsing fails, leave name unchanged
      }
    }

    try {
      state.data.name = await inputCredentialNameStep(
        input,
        state,
        serverType,
        productName,
        credentials,
      );
    } catch (e) {
      // the user cancelled - clear the default name so that validation fails and the credential isn't saved
      state.data.name = undefined;
      throw e;
    }

    // last step to create a new credential
  }

  // ***************************************************************
  // Get the list of existing credentials while showing progress.
  // Kick off the input collection and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************
  credentials = await getExistingCredentials(viewId, credentialsService);
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

  const {
    name,
    url,
    apiKey,
    token,
    privateKey,
    snowflakeConnection,
    oauthClientId,
    accessToken,
    refreshToken,
    tokenExpiresAt,
  } = state.data;

  if (!isString(name) || !isString(url)) {
    return undefined;
  }

  // create the credential!
  let credential: Credential | undefined = undefined;
  try {
    credential = await credentialsService.create({
      name,
      url,
      serverType,
      apiKey: isString(apiKey) ? apiKey : undefined,
      token: isString(token) ? token : undefined,
      privateKey: isString(privateKey) ? privateKey : undefined,
      snowflakeConnection: isString(snowflakeConnection)
        ? snowflakeConnection
        : undefined,
      oauthClientId: isString(oauthClientId) ? oauthClientId : undefined,
      accessToken: isString(accessToken) ? accessToken : undefined,
      refreshToken: isString(refreshToken) ? refreshToken : undefined,
      tokenExpiresAt: isString(tokenExpiresAt) ? tokenExpiresAt : undefined,
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return credential;
}
