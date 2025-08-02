// Copyright (C) 2025 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
  isQuickPickItem,
  isQuickPickItemWithIndex,
  AbortError,
  InputStep,
  InfoMessageParameters,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, window } from "vscode";

import {
  useApi,
  Credential,
  SnowflakeConnection,
  ServerType,
  ProductName,
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
  isConnectCloud,
  getPublishableAccounts,
  fetchDeviceAuth,
  fetchAuthToken,
  fetchConnectCloudAccounts,
} from "src/multiStepInputs/common";
import { getEnumKeyByEnumValue } from "src/utils/enums";
import {
  AuthToken,
  ConnectCloudAccount,
  ConnectCloudData,
  DeviceAuth,
} from "src/api/types/connectCloud";
import {
  CONNECT_CLOUD_SIGNUP_URL,
  CONNECT_CLOUD_ACCOUNT_URL,
} from "src/constants";

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

  // the serverType & productName will be overwritten in the very first step
  // when the platform is selected
  let serverType: ServerType = ServerType.CONNECT;
  let productName: ProductName = ProductName.CONNECT;
  let connections: SnowflakeConnection[] = [];
  let connectionQuickPicks: QuickPickItemWithIndex[];

  const connectCloudData: ConnectCloudData = {
    accounts: [],
    auth: {
      deviceCode: "",
      userCode: "",
      verificationURI: "",
      interval: 0,
    },
  };

  const getSnowflakeConnections = async (serverUrl: string) => {
    const sfc = await fetchSnowflakeConnections(serverUrl);
    connections = sfc.connections;
    connectionQuickPicks = sfc.connectionQuickPicks;
  };

  // reset all Connect data to empty strings so new credentials will saved
  const resetConnectData = (state: MultiStepState) => {
    state.data.url = "";
    state.data.apiKey = "";
    state.data.snowflakeConnection = "";
  };

  // reset all Connect Clound data to empty strings so new credentials will saved
  const resetConnectCloudData = (state: MultiStepState) => {
    state.data.accessToken = "";
    state.data.refreshToken = "";
    state.data.accountId = "";
    state.data.accountName = "";
  };

  // update the device auth data for Connect Cloud
  const updateConnectCloudAuthData = (data?: DeviceAuth) => {
    connectCloudData.auth.deviceCode = data?.deviceCode || "";
    connectCloudData.auth.verificationURI = data?.verificationURI || "";
    connectCloudData.auth.userCode = data?.userCode || "";
    connectCloudData.auth.interval = data?.interval || 0;
  };

  // ***************************************************************
  // Order of all steps for creating a new Connect credential
  // ***************************************************************

  // Select the platform
  // Get the server url
  // Get the API key for Connect OR get the Snowflake connection name
  // Get the credential name
  // result in calling credential API

  // ***************************************************************
  // Order of all steps for creating a new Connect Cloud credential
  // ***************************************************************

  // Select the platform
  // Initialize the device authentication
  // Poll the device authentication
  // Retrive the user's accounts
  // Determine the correct next step:
  //  - If there is only one publishable account:
  //    Get the credential name
  //  - If there are multiple publishable accounts:
  //    Get selected account from account list
  //    Get the credential name
  //  - If there are no publishable accounts, but there is at least one account:
  //    Get sign up for individual plan
  //    Initialize the device authentication
  //    Poll the device authentication
  //    Poll for the user's new account
  //    Determine the correct next step
  //     - There will be only one publishable account:
  //       Get the credential name
  //  - If there are zero accounts for the user:
  //    Poll for the user's new account
  //    Determine the correct next step
  //     - There will be only one publishable account:
  //       Get the credential name
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
        accessToken: <string | undefined>undefined, // eventual type is string
        refreshToken: <string | undefined>undefined, // eventual type is string
        accountId: <string | undefined>undefined, // eventual type is string
        accountName: <string | undefined>undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    if (extensionSettings.enableConnectCloud()) {
      // select the platform only when the enableConnectCloud config has been turned on
      await MultiStepInput.run({
        step: (input) => inputPlatform(input, state),
      });
    } else {
      // default to CONNECT (since there are no other products at the moment)
      // when the enableConnectCloud config is turned off
      serverType = ServerType.CONNECT;
      productName = ProductName.CONNECT;
      resetConnectCloudData(state);

      await MultiStepInput.run({
        step: (input) => inputServerUrl(input, state),
      });
    }
    return state;
  }

  // ***************************************************************
  // Step: Select the platform for the credential (used for all platforms)
  // ***************************************************************
  async function inputPlatform(input: MultiStepInput, state: MultiStepState) {
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

    const enumKey = getEnumKeyByEnumValue(ProductName, pick.label);
    // fallback to CONNECT if there is ever a case when the enumKey is not found
    serverType = enumKey ? ServerType[enumKey] : ServerType.CONNECT;
    productName = pick.label as ProductName;

    if (isConnectCloud(serverType)) {
      resetConnectData(state);
      return {
        step: (input: MultiStepInput) => initDeviceAuth(input, state),
        skippable: true,
      };
    }

    if (isConnect(serverType)) {
      resetConnectCloudData(state);
      return {
        step: (input: MultiStepInput) => inputServerUrl(input, state),
      };
    }

    // Should not land here since the platform is forcefully picked in the very first step
    return;
  }

  // ***************************************************************
  // Step: Kick-off device authentication for Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function initDeviceAuth(input: MultiStepInput, state: MultiStepState) {
    try {
      // we await this input box that it is treated as an information message
      // until the api calls happening in the background have completed
      const resp = await input.showInfoMessage<
        DeviceAuth,
        InfoMessageParameters<DeviceAuth>
      >({
        title: state.title,
        step: 0,
        totalSteps: 0,
        // disables user input
        enabled: false,
        // shows a progress indicator on the input box
        busy: true,
        value: "Authenticating with Connect Cloud ...",
        // moves the cursor to the start of the value text to avoid the automated text highlight
        valueSelection: [0, 0],
        // displays a custom information message below the input box that hides the prompt and
        // default message: "Please 'Enter' to confirm your input or 'Escape' to cancel"
        validationMessage: {
          message:
            "Please follow the next steps in the external browser or 'Escape' to abort",
          severity: InputBoxValidationSeverity.Info,
        },
        prompt: "",
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
        apiFunction: () => fetchDeviceAuth(),
      });
      updateConnectCloudAuthData(resp.data);
    } catch (error) {
      if (error instanceof AbortError) {
        // swallows the custom internal error because we don't need
        // an error message everytime the user decides to abort or
        // whenever the user just plain abandones the task
        return;
      } else if (error instanceof Error) {
        // display an error message for all other errors
        window.showErrorMessage(
          `Failed to authenticate. ${getSummaryStringFromError("newCredentials, fetchDeviceAuth", error)}`,
        );
      }
      return;
    }

    return {
      step: (input: MultiStepInput) => authenticate(input, state),
      skippable: true,
    };
  }

  // ***************************************************************
  // Step: Complete device authentication for Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function authenticate(input: MultiStepInput, state: MultiStepState) {
    try {
      // we await this input box that it is treated as an information message
      // until the api calls happening in the background have completed
      const resp = await input.showInfoMessage<
        AuthToken,
        InfoMessageParameters<AuthToken>
      >({
        title: state.title,
        step: 0,
        totalSteps: 0,
        // disables user input
        enabled: false,
        // shows a progress indicator on the input box
        busy: true,
        value: `Authenticating with Connect Cloud ... (using code: ${connectCloudData.auth.userCode})`,
        // moves the cursor to the start of the value text to avoid the automated text highlight
        valueSelection: [0, 0],
        // displays a custom information message below the input box that hides the prompt and
        // default message: "Please 'Enter' to confirm your input or 'Escape' to cancel"
        validationMessage: {
          message:
            "Please follow the next steps in the external browser or 'Escape' to abort",
          severity: InputBoxValidationSeverity.Info,
        },
        prompt: "",
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
        apiFunction: () => fetchAuthToken(connectCloudData.auth.deviceCode),
        shouldPollApi: true,
        pollingInterval: connectCloudData.auth.interval * 1000,
        exitPollingCondition: (r) => Boolean(r.data),
        browserUrl: `${connectCloudData.signupUrl || ""}${connectCloudData.auth.verificationURI}`,
      });
      state.data.accessToken = resp.data?.accessToken;
      state.data.refreshToken = resp.data?.refreshToken;
      // clean-up
      connectCloudData.signupUrl = undefined;
      updateConnectCloudAuthData();
    } catch (error) {
      if (error instanceof AbortError) {
        // swallows the custom internal error because we don't need
        // an error message everytime the user decides to abort or
        // whenever the user just plain abandones the task
        return;
      } else if (error instanceof Error) {
        // display an error message for all other errors
        window.showErrorMessage(
          `Failed to authenticate. ${getSummaryStringFromError("newCredentials, fetchAuthToken", error)}`,
        );
      }
      return;
    }

    return {
      step: (input: MultiStepInput) => retrieveAccounts(input, state),
      skippable: true,
    };
  }

  // ***************************************************************
  // Step: Retrieve the user's accounts from Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function retrieveAccounts(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const accessToken =
      typeof state.data.accessToken === "string" &&
      state.data.accessToken.length
        ? state.data.accessToken
        : "";

    try {
      // we await this input box that it is treated as an information message
      // until the api calls happening in the background have completed
      const resp = await input.showInfoMessage<
        ConnectCloudAccount[],
        InfoMessageParameters<ConnectCloudAccount[]>
      >({
        title: state.title,
        step: 0,
        totalSteps: 0,
        // disables user input
        enabled: false,
        // shows a progress indicator on the input box
        busy: true,
        value: "Retrieving accounts from Connect Cloud ...",
        // moves the cursor to the start of the value text to avoid the automated text highlight
        valueSelection: [0, 0],
        // displays a custom information message below the input box that hides the prompt and
        // default message: "Please 'Enter' to confirm your input or 'Escape' to cancel"
        validationMessage: {
          message:
            "Please wait while we get your account data or 'Escape' to abort",
          severity: InputBoxValidationSeverity.Info,
        },
        prompt: "",
        shouldResume: () => Promise.resolve(false),
        ignoreFocusOut: true,
        apiFunction: () => fetchConnectCloudAccounts(accessToken),
        shouldPollApi: connectCloudData.shouldPoll,
        exitPollingCondition: (r) => Boolean(r.data && r.data.length > 0),
        browserUrl: connectCloudData.accountUrl,
      });
      connectCloudData.accounts = resp.data || [];
      // clean-up
      connectCloudData.accountUrl = undefined;
      connectCloudData.shouldPoll = undefined;
    } catch (error) {
      if (error instanceof AbortError) {
        // swallows the custom internal error because we don't need
        // an error message everytime the user decides to abort or
        // whenever the user just plain abandones the task
        return;
      } else if (error instanceof Error) {
        // display an error message for all other errors
        window.showErrorMessage(
          `Unable to retrieve accounts from Connect Cloud. ${getSummaryStringFromError("newCredentials, fetchConnectCloudAccounts", error)}`,
        );
      }
      return;
    }

    return {
      step: (input: MultiStepInput) => determineAccountFlow(input, state),
      skippable: true,
    };
  }

  // ***************************************************************
  // Step: Determine the correct flow for the user's account list (Connect Cloud only)
  // ***************************************************************
  function determineAccountFlow(_: MultiStepInput, state: MultiStepState) {
    const accounts = getPublishableAccounts(connectCloudData.accounts);
    let step: (input: MultiStepInput) => Thenable<InputStep | void>;
    let skippable: boolean | undefined;

    if (accounts.length === 1) {
      // case 1: there is only one publishable account, use it and create the credential
      state.data.accountId = accounts[0].id;
      state.data.accountName = accounts[0].displayName;
      step = (input: MultiStepInput) => inputCredentialName(input, state);
    } else if (accounts.length > 1) {
      // case 2: there are multiple publishable accounts, display the account selector
      step = (input: MultiStepInput) => inputAccount(input, state);
    } else {
      if (connectCloudData.accounts.length > 0) {
        // case 3: there are no publishable accounts, but the user has at least one account,
        // so they could be a guest or viewer on that account, ask if they want to sign up
        step = (input: MultiStepInput) => inputSignup(input, state);
      } else {
        // case 4: there are zero accounts for the user, so they must be going through the
        // sign up process, open a browser to finish creating the account in Connect Cloud

        // populate the account polling props
        connectCloudData.shouldPoll = true;
        connectCloudData.accountUrl = CONNECT_CLOUD_ACCOUNT_URL;

        // call the retrieveAccounts step again with the populated polling props
        step = (input: MultiStepInput) => retrieveAccounts(input, state);
        skippable = true;
      }
    }

    // must return a promise since the step itself does not await on anything
    return Promise.resolve({ step, skippable });
  }

  // ***************************************************************
  // Step: Select the Connect Cloud account for the credential (Connect Cloud only)
  // ***************************************************************
  async function inputAccount(input: MultiStepInput, state: MultiStepState) {
    const accounts = getPublishableAccounts(connectCloudData.accounts);

    // display the account selector
    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: 0,
      placeholder:
        "Please select the Connect Cloud account to be used for the new credential.",
      items: accounts.map((a) => ({ label: a.displayName })),
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    const account = accounts.find((a) => a.displayName === pick.label);
    // fallback to the first publishable account if the selected account is ever not found
    state.data.accountId = account?.id || accounts[0].id;
    state.data.accountName = account?.displayName || accounts[0].displayName;

    return {
      step: (input: MultiStepInput) => inputCredentialName(input, state),
    };
  }

  // ***************************************************************
  // Step: Select whether to sign up for a Connect Cloud account (Connect Cloud only)
  // ***************************************************************
  async function inputSignup(input: MultiStepInput, state: MultiStepState) {
    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: 0,
      placeholder:
        "This Posit Connect Cloud account is not publishable. Sign up for an indiviual plan?",
      items: [
        { label: "Sign up for an individual Posit Connect Cloud plan" },
        { label: "Exit" },
      ],
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    if (pick.label === "Exit") {
      // bail out
      return;
    }

    // populate the sign up url
    connectCloudData.signupUrl = CONNECT_CLOUD_SIGNUP_URL;
    // populate the account polling props
    connectCloudData.shouldPoll = true;
    connectCloudData.accountUrl = CONNECT_CLOUD_ACCOUNT_URL;

    // go to the authenticate step again to have the user sign up for an individual plan
    return {
      step: (input: MultiStepInput) => initDeviceAuth(input, state),
      skippable: true,
    };
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
      return {
        step: (input: MultiStepInput) => inputAPIKey(input, state),
      };
    }

    if (isSnowflake(serverType)) {
      return {
        step: (input: MultiStepInput) => inputSnowflakeConnection(input, state),
      };
    }

    // Should not land here since the platform is forcefully picked in the very first step
    return;
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
    const currentName =
      typeof state.data.name === "string" && state.data.name.length
        ? state.data.name
        : "";

    const accountName =
      typeof state.data.accountName === "string" &&
      state.data.accountName.length
        ? state.data.accountName
        : "";

    const name = await input.showInputBox({
      title: state.title,
      step: 0,
      totalSteps: 0,
      value: currentName,
      prompt: `Enter a unique nickname for this ${isConnectCloud(serverType) ? "account" : "server"}.`,
      placeholder: `${isConnectCloud(serverType) ? accountName : productName}`,
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
    isQuickPickItem(state.data.name) ||
    state.data.accessToken === undefined ||
    isQuickPickItem(state.data.accessToken) ||
    state.data.refreshToken === undefined ||
    isQuickPickItem(state.data.refreshToken) ||
    state.data.accountId === undefined ||
    isQuickPickItem(state.data.accountId) ||
    state.data.accountName === undefined ||
    isQuickPickItem(state.data.accountName)
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
      state.data.accountId,
      state.data.accountName,
      state.data.refreshToken,
      state.data.accessToken,
      serverType,
    );
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return state.data.name;
}
