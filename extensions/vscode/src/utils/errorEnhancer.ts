// Copyright (C) 2024 by Posit Software, PBC.

export enum ErrorMessageActionIds {
  EditConfiguration,
}

export function isErrorMessageActionId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchValue: any,
): searchValue is ErrorMessageActionIds {
  return Object.values(ErrorMessageActionIds).includes(searchValue);
}

export interface ErrorMessageSplitOption {
  detectionStr: string;
  anchorStr?: string;
  buttonStr?: string;
  actionId: ErrorMessageActionIds;
}

export const ErrorMessageSplitOptions: ErrorMessageSplitOption[] = [
  {
    detectionStr: "editing your configuration",
    anchorStr: "editing",
    buttonStr: "Edit Configuration",
    actionId: ErrorMessageActionIds.EditConfiguration,
  },
];

export function findErrorMessageSplitOption(
  actionId: ErrorMessageActionIds,
): ErrorMessageSplitOption | undefined;
export function findErrorMessageSplitOption(
  errorMessage: string,
): ErrorMessageSplitOption | undefined;
export function findErrorMessageSplitOption(
  target: ErrorMessageActionIds | string,
): ErrorMessageSplitOption | undefined {
  return ErrorMessageSplitOptions.find((option) => {
    if (typeof target === "string") {
      return target.includes(option.detectionStr);
    }
    if (isErrorMessageActionId(target)) {
      return option.actionId === target;
    }
    return false;
  });
}
