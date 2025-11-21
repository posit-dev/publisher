// Copyright (C) 2025 by Posit Software, PBC.

import { ConfigurationInspectionResult } from "../api";
import {
  isAxiosErrorWithJson,
  resolveAgentJsonErrorMsg,
} from "../utils/errorTypes";
import {
  QuickPickItem,
  window,
  Disposable,
  QuickInputButton,
  QuickInput,
  QuickInputButtons,
  InputBoxValidationMessage,
  env,
} from "vscode";

export class AbortError extends Error {}

export interface ApiResponse<T> {
  // data returned from the api request
  data?: T;
  // a number (usually in ms) used to adjust the interval frequency
  intervalAdjustment: number;
}

class InputFlowAction {
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

export function isQuickPickItem(d: QuickPickItem | string): d is QuickPickItem {
  return typeof d !== "string";
}

export function isString(d: StateData): d is string {
  return typeof d === "string";
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

export type StateData =
  | QuickPickItem
  | QuickPickItemWithInspectionResult
  | string
  | undefined;

export interface MultiStepState {
  title: string;
  step: number;
  lastStep: number;
  totalSteps: number;
  data: Record<string, StateData>;
  promptStepNumbers: Record<string, number>;
  // state data validator
  isValid: () => boolean | void;
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

// InputStep now can have 'skipStepHistory' and 'name' properties (optional)
export type InputStep = {
  // the name for the step
  name?: string;
  // used to optionally skip adding the step to the history stack
  skipStepHistory?: boolean;
  step: (input: MultiStepInput) => Thenable<InputStep | void>;
};

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
}

export interface InfoMessageParameters<T> {
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
  apiFunction: () => Promise<ApiResponse<T>>;
  shouldPollApi?: boolean;
  pollingInterval?: number;
  exitPollingCondition?: (resp: ApiResponse<T>) => boolean;
  browserUrl?: string;
}

export class MultiStepInput {
  // These were templatized: static async run<T>(start: InputStep) {
  static run(start: InputStep, previousSteps?: InputStep[]) {
    const input = new MultiStepInput();
    if (previousSteps) {
      input.steps.push(...previousSteps);
    }
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = []; // store the steps in a history stack

  // These were templatized: private async stepThrough<T>(start: InputStep) {
  private async stepThrough(start: InputStep) {
    let currentStep: InputStep | void = start;
    while (currentStep) {
      if (!currentStep.skipStepHistory) {
        // add the current step to the history
        this.steps.push(currentStep);
      }
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        currentStep = await currentStep.step(this);
      } catch (err) {
        // handle "Back" button press
        if (err === InputFlowAction.back) {
          // remove the current step (the one that caused the 'back' action)
          this.steps.pop();
          currentStep = this.steps.pop();

          if (this.steps.length === 0 && currentStep === undefined) {
            // if we've popped everything, effectively cancel the input flow
            throw InputFlowAction.cancel;
          }
        } else if (err === InputFlowAction.resume) {
          currentStep = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          // cancel the whole flow
          currentStep = undefined;
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
          input.onDidChangeSelection((items) => {
            if (items[0] !== undefined) {
              resolve(items[0]);
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

  async showInfoMessage<T, P extends InfoMessageParameters<T>>({
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
    apiFunction,
    shouldPollApi,
    pollingInterval,
    exitPollingCondition,
    browserUrl,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<ApiResponse<T>>(
        // eslint-disable-next-line no-async-promise-executor
        async (resolve, reject) => {
          let abortPolling = false;
          // default the polling interval to 2 seconds
          pollingInterval ||= 2000;
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

          if (browserUrl) {
            // @ts-expect-error the resulting URL may have multiple levels of nested redirects:
            // url 1 -> redirect to url 2 -> redirect to url 3 -> etc.
            // Unfortunately that much nesting of redirect params encoding is not properly handled
            // by vscode: `env.openExternal(Uri.parse(browserUrl))`.
            // Therefore, we have to give the string URL directly to `env.openExternal` and ignore
            // the type error from typescript so the encoding is correct for the nested redirects.

            // await opening the external browser window so the polling
            // actually begins after the user selects an option from the open browser pop-up
            await env.openExternal(browserUrl);

            // bail out if the user did anything on the openExternal window operation
            // to cause the multi-stepper to be hidden
            if (abortPolling) {
              // return custom internal error when aborting
              return reject(new AbortError()); // bubble up the error
            }
          }

          const pollApiFunction = async (
            interval: number,
            maxAttempts?: number,
          ): Promise<ApiResponse<T>> => {
            let attempts = 0;

            // polling loop
            while (true) {
              const resp = await apiFunction();
              interval += resp.intervalAdjustment;

              if (
                !shouldPollApi ||
                (exitPollingCondition && exitPollingCondition(resp))
              ) {
                // either no polling is needed or we have met the exit condition, stop polling
                return resp;
              }

              attempts++;
              if ((maxAttempts && attempts >= maxAttempts) || abortPolling) {
                // return custom internal error when aborting or
                // when the max attempts have been reached
                throw new AbortError(); // bubble up the error
              }

              // exit condition has not been met, wait the interval time and poll again
              await new Promise((resolve) => setTimeout(resolve, interval));
            }
          };

          // start polling (poll every 2 seconds at most 300 times === 10 minutes max time)
          return pollApiFunction(pollingInterval, 300)
            .then(resolve)
            .catch(reject);
        },
      ); // outer promise end
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}
