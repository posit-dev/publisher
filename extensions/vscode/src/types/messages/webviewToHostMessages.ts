// Copyright (C) 2024 by Posit Software, PBC.

import { HomeViewState } from "../shared";

export enum WebviewToHostMessageType {
  // Sent from webviewView to host
  DEPLOY = "deploy",
  INITIALIZING = "initializing",
  EDIT_CONFIGURATION = "editConfiguration",
  NEW_CONFIGURATION = "newConfiguration",
  SELECT_CONFIGURATION = "selectConfiguration",
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
  SELECT_DESTINATION = "selectDestination",
  NEW_DESTINATION = "newDestination",
  NEW_CREDENTIAL = "newCredential",
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
  | NewConfigurationMsg
  | SelectConfigurationMsg
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
  | SelectDestinationMsg
  | NewDestinationMsg
  | NewCredentialMsg;

export function isWebviewToHostMessage(msg: any): msg is WebviewToHostMessage {
  return (
    msg.kind === WebviewToHostMessageType.DEPLOY ||
    msg.kind === WebviewToHostMessageType.EDIT_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.INITIALIZING ||
    msg.kind === WebviewToHostMessageType.NAVIGATE ||
    msg.kind === WebviewToHostMessageType.NEW_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.SELECT_CONFIGURATION ||
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
    msg.kind === WebviewToHostMessageType.SELECT_DESTINATION ||
    msg.kind === WebviewToHostMessageType.NEW_DESTINATION ||
    msg.kind === WebviewToHostMessageType.NEW_CREDENTIAL
  );
}

export type DeployMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.DEPLOY,
  {
    contentRecordName: string;
    credentialName: string;
    configurationName: string;
  }
>;

export type InitializingMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.INITIALIZING>;

export type EditConfigurationMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.EDIT_CONFIGURATION,
  {
    configurationName: string;
  }
>;

export type NewConfigurationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_CONFIGURATION>;

export type SelectConfigurationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SELECT_CONFIGURATION>;

export type NavigateMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.NAVIGATE,
  {
    uriPath: string;
  }
>;

export type SaveSelectionStatedMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.SAVE_SELECTION_STATE,
  {
    state: HomeViewState;
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

export type SelectDestinationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SELECT_DESTINATION>;

export type NewDestinationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_DESTINATION>;

export type NewCredentialMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_CREDENTIAL>;
