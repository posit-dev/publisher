// Copyright (C) 2024 by Posit Software, PBC.

import { HomeViewState } from "../shared";

export enum WebviewToHostMessageType {
  // Sent from webviewView to host
  DEPLOY = "deploy",
  INITIALIZING = "initializing",
  NEW_DEPLOYMENT = "newDeployment",
  EDIT_CONFIGURATION = "editConfiguration",
  NEW_CONFIGURATION = "newConfiguration",
  NAVIGATE = "navigate",
  SAVE_DEPLOYMENT_BUTTON_EXPANDED = "saveDeploymentButtonExpanded",
  SAVE_SELECTION_STATE = "saveSelectionState",
  REFRESH_PYTHON_PACKAGES = "refreshPythonPackages",
  RELATIVE_OPEN_VSCODE = "relativeOpenVSCode",
  SCAN_PYTHON_PACKAGE_REQUIREMENTS = "scanPythonPackageRequirements",
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
  | NewDeploymentMsg
  | EditConfigurationMsg
  | NewConfigurationMsg
  | NavigateMsg
  | SaveDeploymentButtonExpandedMsg
  | SaveSelectionStatedMsg
  | RefreshPythonPackages
  | relativeOpenVSCode
  | ScanPythonPackageRequirements;

export function isWebviewToHostMessage(msg: any): msg is WebviewToHostMessage {
  return (
    msg.kind === WebviewToHostMessageType.DEPLOY ||
    msg.kind === WebviewToHostMessageType.EDIT_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.INITIALIZING ||
    msg.kind === WebviewToHostMessageType.NAVIGATE ||
    msg.kind === WebviewToHostMessageType.NEW_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.NEW_DEPLOYMENT ||
    msg.kind === WebviewToHostMessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED ||
    msg.kind === WebviewToHostMessageType.SAVE_SELECTION_STATE ||
    msg.kind === WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES ||
    msg.kind === WebviewToHostMessageType.RELATIVE_OPEN_VSCODE ||
    msg.kind === WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS
  );
}

export type DeployMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.DEPLOY,
  {
    deploymentName: string;
    credentialName: string;
    configurationName: string;
  }
>;

export type InitializingMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.INITIALIZING>;

export type NewDeploymentMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_DEPLOYMENT>;

export type EditConfigurationMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.EDIT_CONFIGURATION,
  {
    configurationName: string;
  }
>;

export type NewConfigurationMsg =
  AnyWebviewToHostMessage<WebviewToHostMessageType.NEW_CONFIGURATION>;

export type NavigateMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.NAVIGATE,
  {
    uriPath: string;
  }
>;

export type SaveDeploymentButtonExpandedMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED,
  {
    expanded: boolean;
  }
>;

export type SaveSelectionStatedMsg = AnyWebviewToHostMessage<
  WebviewToHostMessageType.SAVE_SELECTION_STATE,
  {
    state: HomeViewState;
  }
>;

export type RefreshPythonPackages =
  AnyWebviewToHostMessage<WebviewToHostMessageType.REFRESH_PYTHON_PACKAGES>;

export type relativeOpenVSCode = AnyWebviewToHostMessage<
  WebviewToHostMessageType.RELATIVE_OPEN_VSCODE,
  {
    relativePath: string;
  }
>;

export type ScanPythonPackageRequirements =
  AnyWebviewToHostMessage<WebviewToHostMessageType.SCAN_PYTHON_PACKAGE_REQUIREMENTS>;
