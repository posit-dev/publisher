// Copyright (C) 2025 by Posit Software, PBC.

import {
  useApi,
  Credential,
  SnowflakeConnection,
  ServerType,
  ProductType,
  ProductName,
  ProductDescription,
} from "src/api";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { isAxiosErrorWithJson } from "src/utils/errorTypes";
import { formatURL, normalizeURL } from "src/utils/url";
import {
  InputBoxValidationSeverity,
  QuickPickItem,
  ThemeIcon,
  window,
} from "vscode";
import {
  AbortError,
  ApiResponse,
  InfoMessageParameters,
  isQuickPickItemWithIndex,
  MultiStepInput,
  MultiStepState,
  QuickPickItemWithIndex,
} from "./multiStepHelper";
import {
  AuthToken,
  ConnectCloudAccount,
  ConnectCloudData,
  DeviceAuth,
} from "src/api/types/connectCloud";
import axios from "axios";
import { getEnumKeyByEnumValue } from "src/utils/enums";
import {
  CONNECT_CLOUD_ACCOUNT_URL,
  CONNECT_CLOUD_SIGNUP_URL,
} from "src/constants";
import { extensionSettings } from "src/extension";
import { openConfigurationCommand } from "src/commands";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { showProgress } from "src/utils/progress";

const createNewCredentialLabel = "Create a New Credential";

type InputStepData = { step: StepFunction; skippable: boolean | undefined };

export enum StepFunction {
  INPUT_PLATFORM = "inputPlatform",
  INIT_DEVICE_AUTH = "initDeviceAuth",
  AUTHENTICATE = "authenticate",
  RETRIEVE_ACCOUNTS = "retrieveAccounts",
  DETERMINE_ACCOUNT_FLOW = "determineAccountFlow",
  INPUT_ACCOUNT = "inputAccount",
  INPUT_SIGNUP = "inputSignup",
  INPUT_SERVER_URL = "inputServerUrl",
  INPUT_API_KEY = "inputAPIKey",
  INPUT_SNOWFLAKE_CONNECTION = "inputSnowflakeConnection",
  INPUT_CREDENTIAL_NAME = "inputCredentialName",
}

// Search for the first credential that includes
// the targetURL.
export function findExistingCredentialByURL(
  credentials: Credential[],
  targetURL: string,
): Credential | undefined {
  return credentials.find((credential) => {
    const existing = normalizeURL(credential.url).toLowerCase();
    const newURL = normalizeURL(targetURL).toLowerCase();
    return newURL.includes(existing);
  });
}

export const isConnect = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT;
};

export const isConnectCloud = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT_CLOUD;
};

export const isSnowflake = (serverType: ServerType) => {
  return serverType === ServerType.SNOWFLAKE;
};

export const getProductType = (serverType: ServerType): ProductType => {
  switch (serverType) {
    case ServerType.CONNECT:
      return ProductType.CONNECT;
    case ServerType.SNOWFLAKE:
      return ProductType.CONNECT;
    case ServerType.CONNECT_CLOUD:
      return ProductType.CONNECT_CLOUD;
  }
};

export const getPublishableAccounts = (accounts: ConnectCloudAccount[]) => {
  return accounts.filter((a) => a.permissionToPublish);
};

// List of all available platforms
export const platformList: QuickPickItem[] = [
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: ProductName.CONNECT_CLOUD,
    description: "",
    detail: ProductDescription.CONNECT_CLOUD,
  },
  {
    iconPath: new ThemeIcon("posit-publisher-posit-logo"),
    label: ProductName.CONNECT,
    description: "",
    detail: ProductDescription.CONNECT,
  },
];

// Fetch the list of all available snowflake connections
export const fetchSnowflakeConnections = async (serverUrl: string) => {
  let connections: SnowflakeConnection[] = [];
  let connectionQuickPicks: QuickPickItemWithIndex[];

  try {
    const api = await useApi();
    const connsResponse = await api.snowflakeConnections.list(serverUrl);
    connections = connsResponse.data;
    connectionQuickPicks = connections.map((connection, i) => ({
      label: connection.name,
      index: i,
    }));
  } catch (error: unknown) {
    if (isAxiosErrorWithJson(error)) {
      throw error;
    }
    const summary = getSummaryStringFromError(
      "newCredentials, snowflakeConnections.list",
      error,
    );
    window.showErrorMessage(
      `Unable to query Snowflake connections. ${summary}`,
    );
    throw error;
  }

  if (!connectionQuickPicks.length) {
    const msg = `No working Snowflake connections found for ${serverUrl}. Please configure a connection in your environment before creating a credential.`;
    window.showErrorMessage(msg);
    throw new Error(msg);
  }

  return { connections, connectionQuickPicks };
};

// Fetch the device auth for Connect Cloud
export const fetchDeviceAuth = async (): Promise<ApiResponse<DeviceAuth>> => {
  const api = await useApi();
  const resp = await api.connectCloud.auth();
  return { data: resp.data, intervalAdjustment: 0 };
};

// Fetch the auth token for Connect Cloud
export const fetchAuthToken = async (
  deviceCode: string,
): Promise<ApiResponse<AuthToken>> => {
  let intervalAdjustment = 0;
  try {
    const api = await useApi();
    const resp = await api.connectCloud.token(deviceCode);
    return { data: resp.data, intervalAdjustment };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data?.code) {
      // handle the expected polling errors
      switch (err.response.data.code) {
        case "deviceAuthSlowDown":
          // adjust the interval by 1 second
          intervalAdjustment = 1000;
          break;
        case "deviceAuthPending":
          // DO NOTHING, this is expected while authenticating
          break;
        default:
          // bubble up any other errors
          throw err;
      }
      // this is not an actual error so return the promise w/o the `data` property
      return { intervalAdjustment };
    } else {
      // there was an unexpected error, bubble up the error
      throw err;
    }
  }
};

// Fetch the user accounts from Connect Cloud
export const fetchConnectCloudAccounts = async (
  accessToken: string,
): Promise<ApiResponse<ConnectCloudAccount[]>> => {
  const api = await useApi();
  const resp = await api.connectCloud.accounts(accessToken);
  return { data: resp.data, intervalAdjustment: 0 };
};

// ***************************************************************
// Step: Select the platform for the credential (used for all platforms)
// ***************************************************************
export const inputPlatformStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  serverType: ServerType,
  productName: ProductName,
) => {
  // CONNECT default
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_SERVER_URL,
    skippable: undefined,
  };

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
  // fallback to the default if there is ever a case when the enumKey is not found
  serverType = enumKey ? ServerType[enumKey] : serverType;
  productName = pick.label as ProductName;

  if (isConnectCloud(serverType)) {
    inputStep.step = StepFunction.INIT_DEVICE_AUTH;
    inputStep.skippable = true;
  }

  return { inputStep, serverType, productName };
};

// ***************************************************************
// Step: Kick-off device authentication for Connect Cloud (Connect Cloud only)
// ***************************************************************
export const initDeviceAuthStep = async (
  input: MultiStepInput,
  state: MultiStepState,
) => {
  const inputStep: InputStepData = {
    step: StepFunction.AUTHENTICATE,
    skippable: true,
  };

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

    return { inputStep, deviceAuth: resp.data };
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
};

// ***************************************************************
// Step: Complete device authentication for Connect Cloud (Connect Cloud only)
// ***************************************************************
export const authenticateStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  connectCloudData: ConnectCloudData,
) => {
  const inputStep: InputStepData = {
    step: StepFunction.RETRIEVE_ACCOUNTS,
    skippable: true,
  };

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

    return { inputStep, authToken: resp.data };
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
};

// ***************************************************************
// Step: Retrieve the user's accounts from Connect Cloud (Connect Cloud only)
// ***************************************************************
export const retrieveAccountsStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  connectCloudData: ConnectCloudData,
) => {
  const inputStep: InputStepData = {
    step: StepFunction.DETERMINE_ACCOUNT_FLOW,
    skippable: true,
  };

  const accessToken =
    typeof state.data.accessToken === "string" ? state.data.accessToken : "";

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

    return { inputStep, accounts: resp.data };
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
};

// ***************************************************************
// Step: Determine the correct flow for the user's account list (Connect Cloud only)
// ***************************************************************
export const determineAccountFlowStep = (
  allAccounts: ConnectCloudAccount[],
) => {
  let accountId: string | undefined = undefined;
  let accountName: string | undefined = undefined;
  let shouldPoll: boolean | undefined = undefined;
  let accountUrl: string | undefined = undefined;
  const accounts = getPublishableAccounts(allAccounts);
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_CREDENTIAL_NAME,
    skippable: undefined,
  };

  if (accounts.length === 1) {
    // case 1: there is only one publishable account, use it and create the credential
    inputStep.step = StepFunction.INPUT_CREDENTIAL_NAME;
    // populate the selected account props
    accountId = accounts[0].id;
    accountName = accounts[0].displayName;
  } else if (accounts.length > 1) {
    // case 2: there are multiple publishable accounts, display the account selector
    inputStep.step = StepFunction.INPUT_ACCOUNT;
  } else {
    if (allAccounts.length > 0) {
      // case 3: there are no publishable accounts, but the user has at least one account,
      // so they could be a guest or viewer on that account, ask if they want to sign up
      inputStep.step = StepFunction.INPUT_SIGNUP;
    } else {
      // case 4: there are zero accounts for the user, so they must be going through the
      // sign up process, open a browser to finish creating the account in Connect Cloud
      inputStep.step = StepFunction.RETRIEVE_ACCOUNTS;
      inputStep.skippable = true;
      // populate the account polling props
      shouldPoll = true;
      accountUrl = CONNECT_CLOUD_ACCOUNT_URL;
    }
  }

  return { inputStep, accountId, accountName, shouldPoll, accountUrl };
};

// ***************************************************************
// Step: Select the Connect Cloud account for the credential (Connect Cloud only)
// ***************************************************************
export const inputAccountStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  allAccounts: ConnectCloudAccount[],
) => {
  const accounts = getPublishableAccounts(allAccounts);
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_CREDENTIAL_NAME,
    skippable: undefined,
  };

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
  const accountId = account?.id || accounts[0].id;
  const accountName = account?.displayName || accounts[0].displayName;

  return { inputStep, accountId, accountName };
};

// ***************************************************************
// Step: Select whether to sign up for a Connect Cloud account (Connect Cloud only)
// ***************************************************************
export const inputSignupStep = async (
  input: MultiStepInput,
  state: MultiStepState,
) => {
  const inputStep: InputStepData = {
    step: StepFunction.INIT_DEVICE_AUTH,
    skippable: true,
  };

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
  const signupUrl = CONNECT_CLOUD_SIGNUP_URL;
  // populate the account polling props
  const shouldPoll = true;
  const accountUrl = CONNECT_CLOUD_ACCOUNT_URL;

  return { inputStep, signupUrl, accountUrl, shouldPoll };
};

// ***************************************************************
// Step: Get the server url (used for Connect & Snowflake)
// ***************************************************************
export const inputServerUrlStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  serverType: ServerType,
  credentials: Credential[],
) => {
  // CONNECT default
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_API_KEY,
    skippable: undefined,
  };

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
        const api = await useApi();
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

  const url = formatURL(resp.trim());

  if (isSnowflake(serverType)) {
    inputStep.step = StepFunction.INPUT_SNOWFLAKE_CONNECTION;
  }

  return { inputStep, url, serverType };
};

// ***************************************************************
// Step: Enter the API Key (Connect only)
// ***************************************************************
export const inputAPIKeyStep = async (
  input: MultiStepInput,
  state: MultiStepState,
) => {
  let url = "";
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_CREDENTIAL_NAME,
    skippable: undefined,
  };

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
        const api = await useApi();
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
          url = testResult.data.url;
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

  const apiKey = resp;

  return { inputStep, apiKey, url };
};

// ***************************************************************
// Step: Enter the Snowflake connection name (Snowflake only)
// ***************************************************************
export const inputSnowflakeConnectionStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  viewId: string,
) => {
  const inputStep: InputStepData = {
    step: StepFunction.INPUT_CREDENTIAL_NAME,
    skippable: undefined,
  };

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

  const snowflakeConnection = connections[pick.index].name;
  const url = connections[pick.index].serverUrl;

  return { inputStep, snowflakeConnection, url };
};

// ***************************************************************
// Step: Name the credential (used for all platforms)
// ***************************************************************
export const inputCredentialNameStep = async (
  input: MultiStepInput,
  state: MultiStepState,
  serverType: ServerType,
  productName: ProductName,
  credentials: Credential[],
) => {
  const currentName =
    typeof state.data.name === "string" ? state.data.name : "";
  const accountName =
    typeof state.data.accountName === "string" ? state.data.accountName : "";

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

  return name.trim();

  // last step to create a new credential
};
