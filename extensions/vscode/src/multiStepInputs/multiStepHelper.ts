// Copyright (C) 2024 by Posit Software, PBC.

import { ConfigurationInspectionResult, useApi } from "src/api";
import {
  isAxiosErrorWithJson,
  resolveAgentJsonErrorMsg,
} from "src/utils/errorTypes";
import {
  QuickPickItem,
  window,
  Disposable,
  QuickInputButton,
  QuickInput,
  QuickInputButtons,
  InputBoxValidationMessage,
  env,
  Uri,
} from "vscode";
import { AuthToken, ConnectCloudAccount } from "src/api/types/connectCloud";
import { getSummaryStringFromError } from "src/utils/errors";
import axios from "axios";

export class AbortError extends Error {}
class InputFlowAction {
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

export function isQuickPickItem(d: QuickPickItem | string): d is QuickPickItem {
  return typeof d !== "string";
}

export type QuickPickItemWithIndex = QuickPickItem & { index: number };
export type QuickPickItemWithInspectionResult = QuickPickItem & {
  inspectionResult?: ConfigurationInspectionResult;
};

export function isQuickPickItemWithIndex(
  d: QuickPickItem | string,
): d is QuickPickItemWithIndex {
  return (d as QuickPickItemWithIndex).index !== undefined;
}

export function isQuickPickItemWithInspectionResult(
  d: QuickPickItem | string,
): d is QuickPickItemWithInspectionResult {
  return (
    (d as QuickPickItemWithInspectionResult).inspectionResult !== undefined
  );
}

export interface MultiStepState {
  title: string;
  step: number;
  lastStep: number;
  totalSteps: number;
  data: Record<
    string,
    QuickPickItem | QuickPickItemWithInspectionResult | string | undefined
  >;
  promptStepNumbers: Record<string, number>;
}

export const assignStep = (state: MultiStepState, uniqueId: string): number => {
  const previous = state.promptStepNumbers[uniqueId];
  if (!previous) {
    const value = state.lastStep + 1;
    state.promptStepNumbers[uniqueId] = value;
    return value;
  }
  return previous;
};

// InputStep now can have a 'skippable' property (optional)
type InputStepFunction = (
  input: MultiStepInput,
) => Promise<InputStepFunction | void>;

interface InputStepWithSkippableFlag {
  stepFunction: InputStepFunction;
  skippable?: boolean;
}

type InputStep = InputStepFunction | InputStepWithSkippableFlag;

interface QuickPickParameters<T extends QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: T[];
  activeItem?: T;
  ignoreFocusOut?: boolean;
  placeholder: string;
  buttons?: QuickInputButton[];
  shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  password?: boolean;
  value: string;
  prompt: string;
  validate?: (
    value: string,
  ) => Promise<string | InputBoxValidationMessage | undefined>;
  finalValidation?: (
    value: string,
  ) => Promise<string | InputBoxValidationMessage | undefined>;
  buttons?: QuickInputButton[];
  ignoreFocusOut?: boolean;
  placeholder?: string;
  shouldResume: () => Thenable<boolean>;
  enabled?: boolean;
  busy?: boolean;
  validationMessage?: string | InputBoxValidationMessage;
  valueSelection?: [number, number];
}
interface InfoMessageParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  ignoreFocusOut?: boolean;
  shouldResume: () => Thenable<boolean>;
  enabled?: boolean;
  busy?: boolean;
  validationMessage?: string | InputBoxValidationMessage;
  valueSelection?: [number, number];
  location?: string;
  poll?: boolean;
  accessToken?: string;
  browserUrl?: string;
}

export class MultiStepInput {
  // These were templatized: static async run<T>(start: InputStep) {
  static run(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = []; // Store the steps in a history stack

  // These were templatized: private async stepThrough<T>(start: InputStep) {
  private async stepThrough(start: InputStep) {
    let currentStep: InputStep | void = start;
    while (currentStep) {
      this.steps.push(currentStep); // Add the current step to the history
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        currentStep = await this.executeStep(currentStep);
      } catch (err) {
        if (err === InputFlowAction.back) {
          // Handle "Back" button press
          this.steps.pop(); // Remove the current step (the one that caused the 'back' action)

          // Iterate backward through the history to find the previous non-skippable step
          while (this.steps.length > 0) {
            const previousStep = this.steps.pop();

            // Extract the step function and check the skippable flag
            const stepToConsider =
              typeof previousStep === "function"
                ? previousStep
                : previousStep?.stepFunction;
            const isSkippable =
              typeof previousStep !== "function" &&
              previousStep?.skippable === true;

            if (!isSkippable) {
              currentStep = stepToConsider; // Found a non-skippable step, go back to it
              break;
            }
            // If skippable, continue popping to find the next non-skippable step
          }

          if (this.steps.length === 0 && currentStep === undefined) {
            // If all previous steps were skippable, and we've popped everything,
            // effectively cancel the input flow.
            throw InputFlowAction.cancel;
          }
        } else if (err === InputFlowAction.resume) {
          currentStep = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          currentStep = undefined; // Cancel the whole flow
        } else {
          let errMsg = `Internal Error: MultiStepInput::stepThrough, err = ${JSON.stringify(err)}.`;
          if (isAxiosErrorWithJson(err)) {
            errMsg = resolveAgentJsonErrorMsg(err);
          }
          window.showErrorMessage(errMsg);
          currentStep = undefined;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
  }

  // Helper to execute the step function, handling the new InputStep type
  private async executeStep(step: InputStep): Promise<InputStep | void> {
    if (typeof step === "function") {
      return await step(this);
    } else {
      return await step.stepFunction(this);
    }
  }

  async showQuickPick<
    T extends QuickPickItem,
    P extends QuickPickParameters<T>,
  >({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    ignoreFocusOut,
    placeholder,
    buttons,
    shouldResume,
  }: P) {
    const disposables: Disposable[] = [];
    const origTitle = title;
    try {
      return await new Promise<
        T | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createQuickPick<T>();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.ignoreFocusOut = ignoreFocusOut ?? false;
        input.placeholder = placeholder;
        input.matchOnDescription = true;
        input.matchOnDetail = true;
        input.items = items;
        if (activeItem) {
          input.activeItems = [activeItem];
        }
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              resolve(<any>item);
            }
          }),
          input.onDidChangeActive((items) => {
            if (!items.length) {
              input.title = `${origTitle} ---- An error has occurred. The filter text does not match any choices. Clear the filter input field to continue.`;
            } else {
              input.title = origTitle;
            }
          }),
          input.onDidChangeSelection((items) => resolve(items[0])),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel,
              );
            })().catch(reject);
          }),
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    finalValidation,
    buttons,
    ignoreFocusOut,
    placeholder,
    shouldResume,
    password,
    enabled,
    busy,
    validationMessage,
    valueSelection,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        string | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createInputBox();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        // enabled must default to true when undefined
        input.enabled = enabled === undefined ? true : enabled;
        input.busy = busy || false;
        input.validationMessage = validationMessage;
        input.valueSelection = valueSelection;

        if (password) {
          input.password = password;
        }

        input.value = value || "";
        input.prompt = prompt;
        input.ignoreFocusOut = ignoreFocusOut ?? false;
        input.placeholder = placeholder;
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];
        let validating: Promise<
          string | InputBoxValidationMessage | undefined
        > = Promise.resolve(undefined);
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              resolve(<any>item);
            }
          }),
          input.onDidAccept(async () => {
            const value = input.value;
            input.enabled = false;
            input.busy = true;

            let validateError: string | InputBoxValidationMessage | undefined =
              undefined;
            if (validate) {
              validateError = await validate(value);
            }
            let finalValidateError:
              | string
              | InputBoxValidationMessage
              | undefined = undefined;
            if (!validateError && finalValidation) {
              finalValidateError = await finalValidation(value);
              input.validationMessage = finalValidateError;
            }
            input.enabled = true;
            input.busy = false;

            // if we resolve, the page will move on.
            // if we don't, then it sticks around.
            if (!validateError && !finalValidateError) {
              resolve(value);
            }
          }),
          input.onDidChangeValue(async (text) => {
            if (validate) {
              const current = validate(text);
              validating = current;
              const validationMessage = await current;
              if (current === validating) {
                input.validationMessage = validationMessage;
              }
            }
          }),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel,
              );
            })().catch(reject);
          }),
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showAuthInfoMessage<P extends InfoMessageParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    ignoreFocusOut,
    shouldResume,
    enabled,
    busy,
    validationMessage,
    valueSelection,
    location,
    browserUrl,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      // eslint-disable-next-line no-async-promise-executor
      return await new Promise<AuthToken>(async (resolve, reject) => {
        const input = window.createInputBox();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        // enabled must default to true when undefined
        input.enabled = enabled === undefined ? true : enabled;
        input.busy = busy || false;
        input.validationMessage = validationMessage;
        input.valueSelection = valueSelection;
        input.value = value || "";
        input.prompt = prompt;
        input.ignoreFocusOut = ignoreFocusOut ?? false;
        disposables.push(
          input.onDidHide(() => {
            // abort polling anytime the multi-stepper is hidden
            abortPolling = true;
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel,
              );
            })().catch(reject);
          }),
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();

        const api = await useApi();
        let abortPolling = false;
        let pollingInterval = 0;
        let deviceCode = "";
        let authUrl = "";

        try {
          // get the device auth details like url, code and interval
          const resp = await api.connectCloud.auth();
          deviceCode = resp.data.deviceCode;
          authUrl = resp.data.verificationURIComplete;
          pollingInterval = resp.data.interval * 1000;
          // display the user code in the message
          input.value += ` (using code: ${resp.data.userCode})`;
        } catch (error) {
          getSummaryStringFromError(`${location}, connectCloud.auth`, error);
          return reject(error); // bubble up the error
        }

        // @ts-expect-error the resulting URL may have 2 levels of nesting with params:
        // lucid logout -> redirect to lucid register -> redirect to lucid aut.
        // Unfortunately that much nesting and the params encoding is not correctly handled
        // by vscode with: env.openExternal(Uri.parse(`${browserUrl || ""}${authUrl}`))
        // hence we have to give the string url directly to `env.openExternal` and ignore
        // the type error from typescript so the encoding is correct for the nested redirecs

        // await opening the external lucid auth browser window so the polling
        // actually begins after the user selects an option from the pop-up
        await env.openExternal(`${browserUrl || ""}${authUrl}`);

        // bail out if the user did anything on the openExternal window operation
        // to cause the multi-stepper to be hidden
        if (abortPolling) {
          // return custom internal error when aborting
          return reject(new AbortError()); // bubble up the error
        }

        const pollAuthApi = async (
          maxAttempts?: number,
        ): Promise<AuthToken> => {
          let attempts = 0;

          const executePolling = async (): Promise<AuthToken> => {
            try {
              const tokenResponse = await api.connectCloud.token(deviceCode);
              // we got the token info, so stop polling for the token
              return tokenResponse.data;
            } catch (err: unknown) {
              if (axios.isAxiosError(err) && err.response?.data?.code) {
                // handle the expected polling errors
                switch (err.response.data.code) {
                  case "deviceAuthSlowDown":
                    pollingInterval += 1000; // slowdown the interval by 1 second
                    break;
                  case "deviceAuthPending":
                    // DO NOTHING, let the polling continue, this is expected while authenticating
                    break;
                  default:
                    throw err; // bubble up any other errors
                }
              } else {
                // there was an unexpected error, bail from polling for the token
                throw err; // bubble up the error
              }
            }

            attempts++;
            if ((maxAttempts && attempts >= maxAttempts) || abortPolling) {
              // return custom internal error when aborting or
              // when the max attemps have been reached
              throw new AbortError(); // bubble up the error
            }
            // exit condition has not been met, wait the interval time and poll again
            await new Promise((resolve) =>
              setTimeout(resolve, pollingInterval),
            );
            return executePolling(); // recursive call to continue polling
          };

          return await executePolling();
        };

        // start the auth polling
        return pollAuthApi(120) // 120 max attempts every 5 seconds means 10 minutes
          .then(resolve)
          .catch((error) => {
            // do not log the custom internal error
            if (!(error instanceof AbortError)) {
              getSummaryStringFromError(
                `${location}, connectCloud.token`,
                error,
              );
            }
            return reject(error); // bubble up the error
          });
      }); // outer promise end
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showAccountInfoMessage<P extends InfoMessageParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    ignoreFocusOut,
    shouldResume,
    enabled,
    busy,
    validationMessage,
    valueSelection,
    poll,
    accessToken,
    browserUrl,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<ConnectCloudAccount[]>(
        // eslint-disable-next-line no-async-promise-executor
        async (resolve, reject) => {
          const input = window.createInputBox();
          input.title = title;
          input.step = step;
          input.totalSteps = totalSteps;
          // enabled must default to true when undefined
          input.enabled = enabled === undefined ? true : enabled;
          input.busy = busy || false;
          input.validationMessage = validationMessage;
          input.valueSelection = valueSelection;
          input.value = value || "";
          input.prompt = prompt;
          input.ignoreFocusOut = ignoreFocusOut ?? false;
          disposables.push(
            input.onDidHide(() => {
              // abort polling anytime the multi-stepper is hidden
              abortPolling = true;
              (async () => {
                reject(
                  shouldResume && (await shouldResume())
                    ? InputFlowAction.resume
                    : InputFlowAction.cancel,
                );
              })().catch(reject);
            }),
          );
          if (this.current) {
            this.current.dispose();
          }
          this.current = input;
          this.current.show();

          const api = await useApi();
          let abortPolling = false;

          if (browserUrl) {
            // await opening the external browser window so the polling
            // actually begins after the user selects an option from the pop-up
            await env.openExternal(Uri.parse(browserUrl));

            // bail out if the user did anything on the openExternal window operation
            // to cause the multi-stepper to be hidden
            if (abortPolling) {
              // return custom internal error when aborting
              return reject(new AbortError()); // bubble up the error
            }
          }

          const pollAccountApi = async (
            maxAttempts?: number,
          ): Promise<ConnectCloudAccount[]> => {
            let attempts = 0;

            const executePolling = async (): Promise<ConnectCloudAccount[]> => {
              const resp = await api.connectCloud.accounts(accessToken || "");
              // we got the account info, so stop polling for the account
              if (!poll || resp.data.length > 0) {
                return resp.data;
              }

              attempts++;
              if ((maxAttempts && attempts >= maxAttempts) || abortPolling) {
                // return custom internal error when aborting or
                // when the max attemps have been reached
                throw new AbortError(); // bubble up the error
              }
              // exit condition has not been met, wait the interval time and poll again
              await new Promise((resolve) => setTimeout(resolve, 5000));
              return executePolling(); // recursive call to continue polling
            };

            return await executePolling();
          };

          // start the account polling
          return pollAccountApi(120) // 120 max attempts every 5 seconds means 10 minutes
            .then(resolve)
            .catch(reject);
        },
      ); // outer promise end
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}
