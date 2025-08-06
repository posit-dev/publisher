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
import {
  isConnect,
  inputCredentialNameStep,
  StepFunction,
  inputServerUrlStep,
  inputAPIKeyStep,
  inputSnowflakeConnectionStep,
  isSnowflake,
} from "src/multiStepInputs/common";

export async function newConnectCredential(
  viewId: string,
  viewTitle: string,
  startingServerUrl?: string,
): Promise<string | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let credentials: Credential[] = [];

  // globals
  const productName: ProductName = ProductName.CONNECT;
  let serverType: ServerType = ServerType.CONNECT;

  const stepFunction: Record<
    StepFunction,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [StepFunction.INPUT_PLATFORM]: () => Promise.resolve(),
    [StepFunction.INIT_DEVICE_AUTH]: () => Promise.resolve(),
    [StepFunction.AUTHENTICATE]: () => Promise.resolve(),
    [StepFunction.RETRIEVE_ACCOUNTS]: () => Promise.resolve(),
    [StepFunction.DETERMINE_ACCOUNT_FLOW]: () => Promise.resolve(),
    [StepFunction.INPUT_ACCOUNT]: () => Promise.resolve(),
    [StepFunction.INPUT_SIGNUP]: () => Promise.resolve(),
    [StepFunction.INPUT_SERVER_URL]: inputServerUrl,
    [StepFunction.INPUT_API_KEY]: inputAPIKey,
    [StepFunction.INPUT_SNOWFLAKE_CONNECTION]: inputSnowflakeConnection,
    [StepFunction.INPUT_CREDENTIAL_NAME]: inputCredentialName,
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

    await MultiStepInput.run({
      step: (input) => stepFunction.inputServerUrl(input, state),
    });
    return state;
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
    return;
  }

  // default anything that hasn't been initialized in the state
  const { apiKey, snowflakeConnection } = state.data;
  state.data.apiKey = typeof apiKey !== "string" ? "" : apiKey;
  state.data.snowflakeConnection =
    typeof snowflakeConnection !== "string" ? "" : snowflakeConnection;

  // create the credential!
  try {
    await api.credentials.create(
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
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return state.data.name;
}
