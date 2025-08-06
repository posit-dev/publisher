// Copyright (C) 2025 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  InputStep,
} from "./multiStepHelper";

import { window } from "vscode";

import { useApi, Credential, ServerType, ProductName } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { showProgress } from "src/utils/progress";
import { extensionSettings } from "src/extension";
import {
  isConnect,
  inputCredentialNameStep,
  inputPlatformStep,
  initDeviceAuthStep,
  StepFunction,
  authenticateStep,
  retrieveAccountsStep,
  determineAccountFlowStep,
  inputAccountStep,
  inputSignupStep,
  inputServerUrlStep,
  inputAPIKeyStep,
  inputSnowflakeConnectionStep,
  isSnowflake,
} from "src/multiStepInputs/common";
import { ConnectCloudData, DeviceAuth } from "src/api/types/connectCloud";

export async function newCredential(
  viewId: string,
  startingServerUrl?: string,
): Promise<string | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let credentials: Credential[] = [];

  const stepFunction: Record<
    StepFunction,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [StepFunction.INPUT_PLATFORM]: inputPlatform,
    [StepFunction.INIT_DEVICE_AUTH]: initDeviceAuth,
    [StepFunction.AUTHENTICATE]: authenticate,
    [StepFunction.RETRIEVE_ACCOUNTS]: retrieveAccounts,
    [StepFunction.DETERMINE_ACCOUNT_FLOW]: determineAccountFlow,
    [StepFunction.INPUT_ACCOUNT]: inputAccount,
    [StepFunction.INPUT_SIGNUP]: inputSignup,
    [StepFunction.INPUT_SERVER_URL]: inputServerUrl,
    [StepFunction.INPUT_API_KEY]: inputAPIKey,
    [StepFunction.INPUT_SNOWFLAKE_CONNECTION]: inputSnowflakeConnection,
    [StepFunction.INPUT_CREDENTIAL_NAME]: inputCredentialName,
  };

  // the serverType & productName will be overwritten in the very first step
  // when the platform is selected
  let serverType: ServerType = ServerType.CONNECT;
  let productName: ProductName = ProductName.CONNECT;

  const connectCloudData: ConnectCloudData = {
    accounts: [],
    auth: {
      deviceCode: "",
      userCode: "",
      verificationURI: "",
      interval: 0,
    },
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

    // default to CONNECT (since there are no other products at the moment)
    serverType = ServerType.CONNECT;
    productName = ProductName.CONNECT;

    if (extensionSettings.enableConnectCloud()) {
      // select the platform only when the enableConnectCloud config has been turned on
      await MultiStepInput.run({
        step: (input) => stepFunction.inputPlatform(input, state),
      });
    } else {
      await MultiStepInput.run({
        step: (input) => stepFunction.inputServerUrl(input, state),
      });
    }
    return state;
  }

  // ***************************************************************
  // Step: Select the platform for the credential (used for all platforms)
  // ***************************************************************
  async function inputPlatform(input: MultiStepInput, state: MultiStepState) {
    const data = await inputPlatformStep(input, state, serverType, productName);
    const { step, skippable } = data.inputStep;

    serverType = data.serverType;
    productName = data.productName;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Kick-off device authentication for Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function initDeviceAuth(input: MultiStepInput, state: MultiStepState) {
    const data = await initDeviceAuthStep(input, state);

    // bail if the step errored out
    if (!data) return;

    const { step, skippable } = data.inputStep;
    updateConnectCloudAuthData(data.deviceAuth);

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Complete device authentication for Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function authenticate(input: MultiStepInput, state: MultiStepState) {
    const data = await authenticateStep(input, state, connectCloudData);

    // bail if the step errored out
    if (!data) return;

    state.data.accessToken = data.authToken?.accessToken;
    state.data.refreshToken = data.authToken?.refreshToken;
    const { step, skippable } = data.inputStep;

    // clean-up
    connectCloudData.signupUrl = undefined;
    updateConnectCloudAuthData();

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Retrieve the user's accounts from Connect Cloud (Connect Cloud only)
  // ***************************************************************
  async function retrieveAccounts(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const data = await retrieveAccountsStep(input, state, connectCloudData);

    // bail if the step errored out
    if (!data) return;

    const { step, skippable } = data.inputStep;
    connectCloudData.accounts = data.accounts || [];

    // clean-up
    connectCloudData.accountUrl = undefined;
    connectCloudData.shouldPoll = undefined;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Determine the correct flow for the user's account list (Connect Cloud only)
  // ***************************************************************
  function determineAccountFlow(_: MultiStepInput, state: MultiStepState) {
    const data = determineAccountFlowStep(connectCloudData.accounts);
    const { step, skippable } = data.inputStep;

    // populate the selected account props
    state.data.accountId = data.accountId;
    state.data.accountName = data.accountName;

    // populate the account polling props
    connectCloudData.shouldPoll = data.shouldPoll;
    connectCloudData.accountUrl = data.accountUrl;

    // must return a promise for function signature to match other functions
    return Promise.resolve({
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    });
  }

  // ***************************************************************
  // Step: Select the Connect Cloud account for the credential (Connect Cloud only)
  // ***************************************************************
  async function inputAccount(input: MultiStepInput, state: MultiStepState) {
    const { accounts } = connectCloudData;
    const data = await inputAccountStep(input, state, accounts);
    const { step, skippable } = data.inputStep;

    // populate the selected account props
    state.data.accountId = data.accountId;
    state.data.accountName = data.accountName;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Select whether to sign up for a Connect Cloud account (Connect Cloud only)
  // ***************************************************************
  async function inputSignup(input: MultiStepInput, state: MultiStepState) {
    const data = await inputSignupStep(input, state);

    // bail if the user bailed out
    if (!data) return;

    const { step, skippable } = data.inputStep;

    // populate the sign up url
    connectCloudData.signupUrl = data.signupUrl;
    // populate the account polling props
    connectCloudData.shouldPoll = data.shouldPoll;
    connectCloudData.accountUrl = data.accountUrl;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Get the server url (used for Connect & Snowflake)
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    const data = await inputServerUrlStep(
      input,
      state,
      serverType,
      credentials,
    );

    const { step, skippable } = data.inputStep;
    state.data.url = data.url;
    // the serverType can be overwritten with SNOWFLAKE in this step
    serverType = data.serverType;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Enter the API Key (Connect only)
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    const data = await inputAPIKeyStep(input, state);
    const { step, skippable } = data.inputStep;

    state.data.apiKey = data.apiKey;
    state.data.url = data.url;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
    };
  }

  // ***************************************************************
  // Step: Enter the Snowflake connection name (Snowflake only)
  // ***************************************************************
  async function inputSnowflakeConnection(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const data = await inputSnowflakeConnectionStep(input, state, viewId);

    // bail if the step errored out
    if (!data) return;

    const { step, skippable } = data.inputStep;

    state.data.snowflakeConnection = data.snowflakeConnection;
    state.data.url = data.url;

    return {
      step: (input: MultiStepInput) => stepFunction[step](input, state),
      skippable,
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

  const isMissingConnectStateData = (state: MultiStepState) => {
    return (
      state.data.url === undefined ||
      isQuickPickItem(state.data.url) ||
      (isConnect(serverType) &&
        (state.data.apiKey === undefined ||
          isQuickPickItem(state.data.apiKey))) ||
      (isSnowflake(serverType) &&
        (state.data.snowflakeConnection === undefined ||
          isQuickPickItem(state.data.snowflakeConnection)))
    );
  };

  const isMissingConnectCloudStateData = (state: MultiStepState) => {
    return (
      state.data.accessToken === undefined ||
      isQuickPickItem(state.data.accessToken) ||
      state.data.refreshToken === undefined ||
      isQuickPickItem(state.data.refreshToken) ||
      state.data.accountId === undefined ||
      isQuickPickItem(state.data.accountId) ||
      state.data.accountName === undefined ||
      isQuickPickItem(state.data.accountName)
    );
  };

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
    state.data.name === undefined ||
    isQuickPickItem(state.data.name) ||
    isMissingConnectStateData(state) ||
    isMissingConnectCloudStateData(state)
  ) {
    return;
  }

  // default anything that hasn't been initialized in the state
  const {
    url,
    apiKey,
    snowflakeConnection,
    accountId,
    accountName,
    refreshToken,
    accessToken,
  } = state.data;
  state.data.url = typeof url !== "string" ? "" : url;
  state.data.apiKey = typeof apiKey !== "string" ? "" : apiKey;
  state.data.snowflakeConnection =
    typeof snowflakeConnection !== "string" ? "" : snowflakeConnection;
  state.data.accountId = typeof accountId !== "string" ? "" : accountId;
  state.data.accountName = typeof accountName !== "string" ? "" : accountName;
  state.data.refreshToken =
    typeof refreshToken !== "string" ? "" : refreshToken;
  state.data.accessToken = typeof accessToken !== "string" ? "" : accessToken;

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
