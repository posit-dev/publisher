// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, ProgressLocation, window } from "vscode";

import { useApi, Credential } from "src/api";
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
  let credentials: Credential[] = [];

  const getCredentials = new Promise<void>(async (resolve, reject) => {
    try {
      const response = await api.credentials.list();
      if (response.data) {
        credentials = response.data;
      }
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "newCredentials, credentials.list",
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
      return getCredentials;
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
      prompt: "Enter the Public URL of the Posit Connect Server",
      placeholder: "example: https://servername.com:3939",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "You must enter a valid Server URL.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        input = formatURL(input);
        try {
          // will validate that this is a valid URL
          new URL(input);
        } catch (e) {
          if (!(e instanceof TypeError)) {
            throw e;
          }
          return Promise.resolve({
            message: "Invalid URL.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        const existingAccount = credentials.find(
          (cred) => input.toLowerCase() === cred.url.toLowerCase(),
        );
        if (existingAccount) {
          return Promise.resolve({
            message: `Server URL is already assigned to your credential "${existingAccount.name}". Only one credential per unique URL is allowed.`,
            severity: InputBoxValidationSeverity.Error,
          });
        }
        return Promise.resolve(undefined);
      },
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    state.data.url = formatURL(url.trim());
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
      placeholder: "example: Posit Connect",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "A credential is required.",
            severity: InputBoxValidationSeverity.Error,
          });
        }
        if (credentials.find((cred) => cred.name === input)) {
          return Promise.resolve({
            message: "Nickname is already in use. Please enter a unique value.",
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
      prompt: "The API key to be used to authenticate with Posit Connect",
      placeholder: "example: v1cKJzUzYnHP1p5WrAINMump4Sjp5pbq",
      validate: (input: string) => {
        input = input.trim();
        if (input === "") {
          return Promise.resolve({
            message: "An API key is required.",
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
    await getCredentials;
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
    await api.credentials.create(
      state.data.name,
      state.data.url,
      state.data.apiKey,
    );
  } catch (error: unknown) {
    const summary = getSummaryStringFromError("credentials::add", error);
    window.showInformationMessage(summary);
  }

  return state.data.name;
}
