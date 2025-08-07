// Copyright (C) 2025 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  InputStep,
  AbortError,
  InfoMessageParameters,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, window } from "vscode";

import { useApi, Credential, ServerType, ProductName } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  inputCredentialNameStep,
  fetchDeviceAuth,
  fetchAuthToken,
  fetchConnectCloudAccounts,
  getPublishableAccounts,
  getExistingCredentials,
} from "src/multiStepInputs/common";
import {
  AuthToken,
  ConnectCloudAccount,
  ConnectCloudData,
  DeviceAuth,
} from "src/api/types/connectCloud";
import {
  CONNECT_CLOUD_ACCOUNT_URL,
  CONNECT_CLOUD_SIGNUP_URL,
} from "src/constants";

export async function newConnectCloudCredential(
  viewId: string,
  viewTitle: string,
  previousStep?: InputStep,
): Promise<Credential | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let credentials: Credential[] = [];

  // globals
  const serverType: ServerType = ServerType.CONNECT_CLOUD;
  const productName: ProductName = ProductName.CONNECT_CLOUD;

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
  // Order of all steps for creating a new Connect Cloud credential
  // ***************************************************************

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
      title: viewTitle,
      // We're going to disable displaying the steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been canceled
        accessToken: <string | undefined>undefined, // eventual type is string
        refreshToken: <string | undefined>undefined, // eventual type is string
        accountId: <string | undefined>undefined, // eventual type is string
        accountName: <string | undefined>undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    await MultiStepInput.run(
      { step: (input) => initDeviceAuth(input, state), skippable: true },
      previousStep,
    );
    return state;
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
      step = (input: MultiStepInput) => inputCredentialName(input, state);
      // populate the selected account props
      state.data.accountId = accounts[0].id;
      state.data.accountName = accounts[0].displayName;
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
        // sign up process, open a browser to finish creating the account in Connect
        step = (input: MultiStepInput) => retrieveAccounts(input, state);
        skippable = true;
        // populate the account polling props
        connectCloudData.shouldPoll = true;
        connectCloudData.accountUrl = CONNECT_CLOUD_ACCOUNT_URL;
      }
    }

    // must return a promise for function signature to match other functions
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
        "You don't have permission to publish to this account. To publish, create a new account.",
      items: [
        { label: "Create a new Posit Connect Cloud account" },
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

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
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
    console.log(
      "User has dismissed the New Connect Cloud Credential flow. Exiting.",
    );
    return;
  }

  // create the credential!
  let newCredential: Credential | undefined = undefined;
  try {
    const resp = await api.credentials.create(
      state.data.name,
      "",
      "",
      "",
      state.data.accountId,
      state.data.accountName,
      state.data.refreshToken,
      state.data.accessToken,
      serverType,
    );
    newCredential = resp.data;
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return newCredential;
}
