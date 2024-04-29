// Copyright (C) 2024 by Posit Software, PBC.

// typesafe creation of a message
// const a3: ConduitMessage = {
//   kind: WebviewToHostMessageType.DEPLOY,
//   content: {
//     deploymentName: "abc".
//     credentialName: "xyz",
//     configurationName: "untitled-1",
//   },
// };

// // working narrowing
// if ((a3.kind = HostToWebviewMessageType.DEPLOY)) {
//   const name = a3.content.configurationName;
// }

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
  | SaveSelectionStatedMsg;

export function isWebviewToHostMessage(msg: any): msg is WebviewToHostMessage {
  return (
    msg.kind === WebviewToHostMessageType.DEPLOY ||
    msg.kind === WebviewToHostMessageType.EDIT_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.INITIALIZING ||
    msg.kind === WebviewToHostMessageType.NAVIGATE ||
    msg.kind === WebviewToHostMessageType.NEW_CONFIGURATION ||
    msg.kind === WebviewToHostMessageType.NEW_DEPLOYMENT ||
    msg.kind === WebviewToHostMessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED ||
    msg.kind === WebviewToHostMessageType.SAVE_SELECTION_STATE
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
