// Copyright (C) 2024 by Posit Software, PBC.

import { window } from "vscode";
import { openFileInEditor } from "src/commands";
import {
  isErrInvalidConfigFile,
  isErrInvalidTOMLFile,
  isErrTomlUnknownError,
  isErrTOMLValidationError,
  isErrUnknownTOMLKey,
} from "src/utils/errorTypes";
import { getSummaryStringFromError } from "src/utils/errors";

// Handler for deployment failures, but intended to only handled the
// errors reported back from the deployment API request. Most deployment
// failures will be returned and handled by the event stream processing
// once the agent has kicked off the anonymous go function which walks through
// the deployment process.
export const showImmediateDeploymentFailureMessage = async (error: unknown) => {
  if (
    isErrTomlUnknownError(error) ||
    isErrUnknownTOMLKey(error) ||
    isErrInvalidTOMLFile(error) ||
    isErrTOMLValidationError(error) ||
    isErrInvalidConfigFile(error)
  ) {
    const editButtonStr = "Edit Configuration";
    const options = [editButtonStr];
    const summary = getSummaryStringFromError("homeView, deploy", error);
    const selection = await window.showErrorMessage(
      `Failed to deploy. ${summary}`,
      ...options,
    );
    // will not support line and column either.
    if (selection === editButtonStr) {
      if (
        isErrTOMLValidationError(error) ||
        isErrTomlUnknownError(error) ||
        isErrInvalidConfigFile(error)
      ) {
        openFileInEditor(error.response.data.details.filename);
        return;
      }
      openFileInEditor(error.response.data.details.filename, {
        selection: {
          start: {
            line: error.response.data.details.line - 1,
            character: error.response.data.details.column - 1,
          },
        },
      });
    }
    return;
  }

  // Default handling for deployment failures we are not handling in a particular way
  const summary = getSummaryStringFromError("homeView, deploy", error);
  return window.showErrorMessage(`Failed to deploy . ${summary}`);
};
