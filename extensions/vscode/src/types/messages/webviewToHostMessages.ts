// Copyright (C) 2024 by Posit Software, PBC.

import { SelectionState } from "../shared";

export enum WebviewToHostMessageType {
  // Sent from webviewView to host
  DEPLOY = "deploy",
  INITIALIZING = "initializing",
  EDIT_CONFIGURATION = "editConfiguration",
  SHOW_SELECT_CONFIGURATION = "showSelectConfiguration",
  NAVIGATE = "navigate",
  SAVE_SELECTION_STATE = "saveSelectionState",
  VSCODE_OPEN = "vsCodeOpen",
  INCLUDE_FILE = "includeFile",
  EXCLUDE_FILE = "excludeFile",
  REQUEST_FILES_LISTS = "requestFilesLists",
  VSCODE_OPEN_RELATIVE = "VSCodeOpenRelativeMsg",
  REFRESH_PYTHON_PACKAGES = "RefreshPythonPackagesMsg",
  SCAN_PYTHON_PACKAGE_REQUIREMENTS = "ScanPythonPackageRequirementsMsg",
  REFRESH_R_PACKAGES = "RefreshRPackagesMsg",
  SCAN_R_PACKAGE_REQUIREMENTS = "ScanRPackageRequirementsMsg",
  SELECT_DEPLOYMENT = "selectDeployment",
  NEW_DEPLOYMENT = "newDeployment",
  NEW_CREDENTIAL = "newCredential",
  VIEW_PUBLISHING_LOG = "viewPublishingLog",
}

export type AnyWebviewToHostMessage<
  T extends WebviewToHostMessageType,
  U extends object | undefined = undefined,
> = U extends undefined
  ? { kind: T }
  : {
      kind: T;
      content: U;
    };

export type WebviewToHostMessage =
  | DeployMsg
  | InitializingMsg
  | EditConfigurationMsg
  | ShowSelectConfigurationMsg
  | NavigateMsg
  | SaveSelectionStatedMsg
  | VSCodeOpenMsg
  | IncludeFileMsg
  | ExcludeFileMsg
  | RequestFilesListsMsg
  | RefreshPythonPackagesMsg
  | VSCodeOpenRelativeMsg
  | ScanPythonPackageRequirementsMsg
  | RefreshRPackagesMsg
  | ScanRPackageRequirementsMsg
  | SelectDeploymentMsg
  | NewDeploymentMsg
  | NewCredentialMsg
  | ViewPublishingLog;

export function isWebviewToHostMessage(msg: any): msg is WebviewToHostMessage {
  return (
    msg.kind === WebviewToHostMessageType.DEPLOY ||
    msg.kind === WebviewToHostMessageType.EDIT_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.INITIALIZING ||
    msg.kind === WebviewToHostMessageType.NAVIGATE ||
    msg.kind === WebviewToHostMessageType.SHOW_SELECT_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.SAVE_SELECTION_STATE ||
    msg.kind === WebviewToHostMessageType.VSCODE_OPEN ||
    msg.kind === WebviewToHostMessageType.INCLUDE_FILE ||
    msg.kind === WebviewToHostMessageType.EXCLUDE_FILE ||
    msg.kind === WebviewToHostMessageType.REQUEST_FILES_LISTS ||
    msg.kind === WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES ||
    msg.kind === WebviewToHostMessageType.VSCODE_OPEN_RELATIVE ||
    msg.kind === WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS ||
    msg.kind === WebviewToHostMessageType.REFRESH_R_PACKAGES ||
    msg.kind === WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS ||
    msg.kind === WebviewToHostMessageType.SELECT_DEPLOYMENT ||
    msg.kind === WebviewToHostMessageType.NEW_DEPLOYMENT ||
    msg.kind === WebviewToHostMessageType.NEW_CREDENTIAL ||
    msg.kind === WebviewToHostMessageType.VIEW_PUBLISHING_LOG
  );
}

export type DeployMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.DEPLOY,
  {
    deploymentName: string;
    credentialName: string;
    configurationName: string;
    projectDir: string;
  }
>;

export type InitializingMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.INITIALIZING>;

export type EditConfigurationMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.EDIT_CONFIGURATION,
  {
    configurationPath: string;
  }
>;

export type ShowSelectConfigurationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SHOW_SELECT_CONFIGURATION>;

export type NavigateMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.NAVIGATE,
  {
    uriPath: string;
  }
>;

export type SaveSelectionStatedMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.SAVE_SELECTION_STATE,
  {
    state: SelectionState;
  }
>;

export type VSCodeOpenMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.VSCODE_OPEN,
  {
    uri: string;
  }
>;

export type IncludeFileMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.INCLUDE_FILE,
  {
    path: string;
  }
>;

export type ExcludeFileMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.EXCLUDE_FILE,
  {
    path: string;
  }
>;

export type RequestFilesListsMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.REQUEST_FILES_LISTS>;

export type RefreshPythonPackagesMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES>;

export type VSCodeOpenRelativeMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
  {
    relativePath: string;
  }
>;

export type ScanPythonPackageRequirementsMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS>;

export type RefreshRPackagesMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.REFRESH_R_PACKAGES>;

export type ScanRPackageRequirementsMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SCAN_R_PACKAGE_REQUIREMENTS>;

export type SelectDeploymentMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SELECT_DEPLOYMENT>;

export type NewDeploymentMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_DEPLOYMENT>;

export type NewCredentialMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_CREDENTIAL>;

export type ViewPublishingLog =
  AnyWebviewToHostMessage<WebviewToHostMessageType.VIEW_PUBLISHING_LOG>;
