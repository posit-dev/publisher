// Copyright (C) 2024 by Posit Software, PBC.

import { HomeViewState } from "../src/views/homeView";
import { Account, Configuration, Deployment, PreDeployment } from "./api";

export enum MessageType {
  // Sent from webviewView to host
  DEPLOY = "deploy",
  INITIALIZING = "initializing",
  NEW_DEPLOYMENT = "newDeployment",
  EDIT_CONFIGURATION = "editConfiguration",
  NEW_CONFIGURATION = "newConfiguration",
  NAVIGATE = "navigate",
  SAVE_DEPLOYMENT_BUTTON_EXPANDED = "saveDeploymentButtonExpanded",
  SAVE_SELECTION_STATE = "saveSelectionState",

  // Sent from host to webviewView
  REFRESH_DEPLOYMENT_DATA = "refreshDeploymentData",
  UPDATE_EXPANSION_FROM_STORAGE = "updateExpansionFromStorage",
  REFRESH_CONFIG_DATA = "refreshConfigData",
  REFRESH_CREDENTIAL_DATA = "refreshCredentialData",
  PUBLISH_START = "publishStart",
  PUBLISH_FINISH_SUCCESS = "publishFinishSuccess",
  PUBLISH_FINISH_FAILURE = "publishFinishFailure",
  UPDATE_DEPLOYMENT_SELECTION = "updateDeploymentSelection",
  UPDATE_CONFIG_SELECTION = "updateConfigSelection",
  SAVE_SELECTION = "saveSelection",
}

interface AnyMessage<T extends MessageType, U extends object = {}> {
  kind: T;
  content: U;
}

export type DeployMsg = AnyMessage<
  MessageType.DEPLOY,
  {
    deploymentName: string;
    credentialName: string;
    configurationName: string;
  }
>;
export type InitializingMsg = AnyMessage<MessageType.INITIALIZING, {}>;
export type NewDeploymentMsg = AnyMessage<MessageType.NEW_DEPLOYMENT, {}>;
export type EditConfigurationMsg = AnyMessage<
  MessageType.EDIT_CONFIGURATION,
  {
    configurationName: string;
  }
>;
export type NewConfigurationMsg = AnyMessage<MessageType.NEW_CONFIGURATION, {}>;
export type NavigateMsg = AnyMessage<
  MessageType.NAVIGATE,
  {
    uriPath: string;
  }
>;
export type SaveDeploymentButtonExpandedMsg = AnyMessage<
  MessageType.SAVE_DEPLOYMENT_BUTTON_EXPANDED,
  {
    expanded: boolean;
  }
>;
export type SaveSelectionStatedMsg = AnyMessage<
  MessageType.SAVE_SELECTION_STATE,
  {
    state: HomeViewState;
  }
>;
export type RefreshDeploymentDataMsg = AnyMessage<
  MessageType.REFRESH_DEPLOYMENT_DATA,
  {
    deployments: (Deployment | PreDeployment)[];
  }
>;
export type UpdateExpansionFromStorageMsg = AnyMessage<
  MessageType.UPDATE_EXPANSION_FROM_STORAGE,
  {
    expansionState: boolean;
  }
>;
export type RefreshConfigDataMsg = AnyMessage<
  MessageType.REFRESH_CONFIG_DATA,
  {
    configurations: Configuration[];
  }
>;
export type RefreshCredentialDataMsg = AnyMessage<
  MessageType.REFRESH_CREDENTIAL_DATA,
  {
    credentials: Account[];
  }
>;
export type PublishStartMsg = AnyMessage<MessageType.PUBLISH_START, {}>;
export type PublishFinishSuccessMsg = AnyMessage<
  MessageType.PUBLISH_FINISH_SUCCESS,
  {}
>;
export type PublishFinishFailureMsg = AnyMessage<
  MessageType.PUBLISH_FINISH_FAILURE,
  {
    data: {
      message: string;
    };
  }
>;
export type UpdateDeploymentSelectionMsg = AnyMessage<
  MessageType.UPDATE_DEPLOYMENT_SELECTION,
  {
    preDeployment: PreDeployment;
    saveSelection?: boolean;
  }
>;
export type UpdateConfigSelectionMsg = AnyMessage<
  MessageType.UPDATE_CONFIG_SELECTION,
  {
    config: Configuration;
    saveSelection?: boolean;
  }
>;
export type SaveSelectionMsg = AnyMessage<MessageType.SAVE_SELECTION, {}>;

export type ConduitMessage =
  | DeployMsg
  | InitializingMsg
  | NewDeploymentMsg
  | EditConfigurationMsg
  | NewConfigurationMsg
  | NavigateMsg
  | SaveDeploymentButtonExpandedMsg
  | SaveSelectionStatedMsg
  | RefreshDeploymentDataMsg
  | UpdateExpansionFromStorageMsg
  | RefreshConfigDataMsg
  | RefreshCredentialDataMsg
  | PublishStartMsg
  | PublishFinishSuccessMsg
  | PublishFinishFailureMsg
  | UpdateDeploymentSelectionMsg
  | UpdateConfigSelectionMsg
  | SaveSelectionMsg;

export function isConduitMessage(msg: any): msg is ConduitMessage {
  return msg.kind && msg.content;
}

export type ConduitCB = (msg: ConduitMessage) => void;

// // working creation
// const a3: ConduitMessage = {
//   kind: MessageType.DEPLOY,
//   content: {
//     deploymentName: "a",
//     credentialName: "b",
//     configurationName: "c",
//   },
// };

// const b: ConduitMessage = {
//   kind: MessageType.EDIT_CONFIGURATION,
//   content: {
//     configurationName: "a",
//   },
// };

// // working narrowing
// if ((a3.kind = MessageType.DEPLOY)) {
//   a3.content.configurationName = "xyz";
// }
