// Copyright (C) 2024 by Posit Software, PBC.

import { ConfigurationInspectionResult } from "src/api";
import {
  QuickPickItem,
  window,
  Disposable,
  QuickInputButton,
  QuickInput,
  QuickInputButtons,
  InputBoxValidationMessage,
} from "vscode";

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

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

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

export class MultiStepInput {
  // These were templatized: static async run<T>(start: InputStep) {
  static run(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = [];

  // These were templatized: rivate async stepThrough<T>(start: InputStep) {
  private async stepThrough(start: InputStep) {
    let step: InputStep | void = start;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (err) {
        if (err === InputFlowAction.back) {
          this.steps.pop();
          step = this.steps.pop();
        } else if (err === InputFlowAction.resume) {
          step = this.steps.pop();
        } else if (err === InputFlowAction.cancel) {
          step = undefined;
        } else {
          window.showErrorMessage(
            `Internal Error: MultiStepInput::stepThrough, err = ${JSON.stringify(err)}.`,
          );
          step = undefined;
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
}
