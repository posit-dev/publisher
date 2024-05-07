// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, ProgressLocation, window } from "vscode";

import { Account, useApi } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import { formatURL } from "src/utils/url";
import { validateApiKey } from "src/utils/apiKeys";

export async function newCredential(
  viewId?: string,
): Promise<string | undefined> {
  // ***************************************************************
  // API Calls and results
  // ***************************************************************
  const api = await useApi();
  let accounts: Account[] = [];

  const getAccounts = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.accounts.getAll();
      if (response.data) {
        accounts = response.data;
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newCredentials, accounts.getAll",
        error,
      );
      window.showInformationMessage(
        `Unable to query existing credentials. ${summary}`,
      );
      return reject();
    }
    return resolve();
  });

  window.withProgress(
    {
      title: "Initializing",
      location: viewId ? { viewId } : ProgressLocation.Window,
    },
    async () => {
      return getAccounts;
    },
  );

  // ***************************************************************
  // Order of all steps
  // ***************************************************************

  // Get the server url
  // Get the server name
  // Get the API key
  // result in calling credential API

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: "Create a New Credential",
      step: -1,
      lastStep: 0,
      totalSteps: -1,
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been cancelled
        url: undefined, // eventual type is string
        name: <string | undefined>undefined, // eventual type is string
        apiKey: <string | undefined>undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    // No optional steps for this one.
    state.totalSteps = 3;

    await MultiStepInput.run((input) => inputServerUrl(input, state));
    return state;
  }

  // ***************************************************************
  // Step #1:
  // Get the server url
  // ***************************************************************
  async function inputServerUrl(input: MultiStepInput, state: MultiStepState) {
    const thisStepNumber = assignStep(state, "inputServerUrl");
    const currentURL =
      typeof state.data.url === "string" && state.data.url.length
        ? state.data.url
        : "";

    const url = await input.showInputBox({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
      value: currentURL,
      prompt: "Enter the Server URL",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "You must enter a valid Server URL.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        try {
          // check if the URL starts with a scheme
          const url = new URL(formatURL(input));
          if (!url.hostname.includes(".")) {
            return Promise.resolve({
              message: "Invalid URL format (no domain).",
              severity: InputBoxValidationSeverity.Error,
            });
          }
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
          (account) => input.toLowerCase() === account.url.toLowerCase(),
        );
        if (existingAccount) {
          return Promise.resolve({
            message: `Server URL is already assigned to your credential ${existingAccount.name}. Only one credential per unique URL is allowed.`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.url = url.trim();
    state.lastStep = thisStepNumber;
    return (input: MultiStepInput) => inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step #2:
  // Name the credential
  // ***************************************************************
  async function inputCredentialName(
    input: MultiStepInput,
    state: MultiStepState,
  ) {
    const thisStepNumber = assignStep(state, "inputCredentialName");
    const currentName =
      typeof state.data.name === "string" && state.data.name.length
        ? state.data.name
        : "";

    const name = await input.showInputBox({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
      value: currentName,
      prompt: "Enter a Unique Nickname for your Credential.",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "A Unique Nickname for your Credential is required.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        if (accounts.find((account) => account.name === input)) {
          return Promise.resolve({
            message:
              "Credential Nickname already in use. Please enter a unique value.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.name = name.trim();
    state.lastStep = thisStepNumber;
    return (input: MultiStepInput) => inputAPIKey(input, state);
  }

  // ***************************************************************
  // Step #3:
  // Enter the API Key
  // ***************************************************************
  async function inputAPIKey(input: MultiStepInput, state: MultiStepState) {
    const thisStepNumber = assignStep(state, "inputAPIKey");
    const currentAPIKey =
      typeof state.data.apiKey === "string" && state.data.apiKey.length
        ? state.data.apiKey
        : "";

    const apiKey = await input.showInputBox({
      title: state.title,
      step: thisStepNumber,
      totalSteps: state.totalSteps,
      value: currentAPIKey,
      prompt:
        "Enter an API key that identifies and grants access to your server.",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "An API key for your Posit Connect server is required.",
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

    state.data.apiKey = apiKey;
    state.lastStep = thisStepNumber;
    // last step, we don't return anything
  }

  // ***************************************************************
  // Wait for the api promise to complete
  // Kick off the input collection
  // and await until it completes.
  // This is a promise which returns the state data used to
  // collect the info.
  // ***************************************************************

  try {
    await getAccounts;
  } catch {
    // errors have already been displayed by the underlying promises..
    return;
  }
  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
    state.data.url === undefined ||
    isQuickPickItem(state.data.url) ||
    state.data.name === undefined ||
    isQuickPickItem(state.data.name) ||
    state.data.apiKey === undefined ||
    isQuickPickItem(state.data.apiKey)
  ) {
    return;
  }

  // create the credential!
  try {
    const api = await useApi();
    await api.credentials.createOrUpdate({
      name: state.data.name,
      url: state.data.url,
      apiKey: state.data.apiKey,
    });
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return state.data.name;
}
