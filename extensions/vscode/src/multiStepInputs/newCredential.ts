// Copyright (C) 2024 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
  assignStep,
} from "./multiStepHelper";

import { InputBoxValidationSeverity, window } from "vscode";

import { useApi, Credential } from "src/api";
import {
  getMessageFromError,
  getSummaryStringFromError,
} from "src/utils/errors";
import { formatURL, normalizeURL } from "src/utils/url";
import { checkSyntaxApiKey } from "src/utils/apiKeys";
import { showProgress } from "src/utils/progress";
import { openConfigurationCommand } from "src/commands";
import { extensionSettings } from "src/extension";

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

  // ***************************************************************
  // Order of all steps
  // ***************************************************************

  // Get the server url
  // Get the credential name
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
        url: startingServerUrl, // eventual type is string
        apiKey: <string | undefined>undefined, // eventual type is string
        name: <string | undefined>undefined, // eventual type is string
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
      placeholder: "https://servername.com:3939",
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
        const existingCredential = credentials.find(
          (credential) =>
            normalizeURL(input).toLowerCase() ===
            normalizeURL(credential.url).toLowerCase(),
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
    state.lastStep = thisStepNumber;
    return (input: MultiStepInput) => inputAPIKey(input, state);
  }

  // ***************************************************************
  // Step #2:
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

    state.data.apiKey = apiKey;
    state.lastStep = thisStepNumber;
    return (input: MultiStepInput) => inputCredentialName(input, state);
  }

  // ***************************************************************
  // Step #3:
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
      prompt: "Enter a unique nickname for this server.",
      placeholder: "Posit Connect",
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
    state.lastStep = thisStepNumber;
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
    state.data.name === undefined ||
    isQuickPickItem(state.data.name)
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
