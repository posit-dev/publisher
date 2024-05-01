// Copyright (C) 2024 by Posit Software, PBC.

import {
  Account,
  Configuration,
  Deployment,
  DeploymentFile,
  PreDeployment,
} from "../../api";

export enum HostToWebviewMessageType {
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
  REFRESH_FILES_LISTS = "refreshFilesLists",
  UPDATE_PYTHON_PACKAGES = "updatePythonPackages",
}

export type AnyHostToWebviewMessage<
  T extends HostToWebviewMessageType,
  U extends object | undefined = undefined,
> = U extends undefined
  ? { kind: T }
  : {
      kind: T;
      content: U;
    };

export type HostToWebviewMessage =
  | RefreshDeploymentDataMsg
  | UpdateExpansionFromStorageMsg
  | RefreshConfigDataMsg
  | RefreshCredentialDataMsg
  | PublishStartMsg
  | PublishFinishSuccessMsg
  | PublishFinishFailureMsg
  | UpdateDeploymentSelectionMsg
  | UpdateConfigSelectionMsg
  | SaveSelectionMsg
  | RefreshFilesListsMsg
  | UpdatePythonPackages;

export function isHostToWebviewMessage(msg: any): msg is HostToWebviewMessage {
  return (
    msg.kind === HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA ||
    msg.kind === HostToWebviewMessageType.UPDATE_EXPANSION_FROM_STORAGE ||
    msg.kind === HostToWebviewMessageType.REFRESH_CONFIG_DATA ||
    msg.kind === HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA ||
    msg.kind === HostToWebviewMessageType.PUBLISH_START ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_FAILURE ||
    msg.kind === HostToWebviewMessageType.UPDATE_DEPLOYMENT_SELECTION ||
    msg.kind === HostToWebviewMessageType.UPDATE_CONFIG_SELECTION ||
    msg.kind === HostToWebviewMessageType.SAVE_SELECTION ||
    msg.kind === HostToWebviewMessageType.REFRESH_FILES_LISTS ||
    msg.kind === HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES
  );
}

export type RefreshDeploymentDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA,
  {
    deployments: (Deployment | PreDeployment)[];
    selectedDeploymentName?: string;
  }
>;
export type UpdateExpansionFromStorageMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_EXPANSION_FROM_STORAGE,
  {
    expansionState: boolean;
  }
>;
export type RefreshConfigDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CONFIG_DATA,
  {
    configurations: Configuration[];
    selectedConfigurationName?: string;
  }
>;
export type RefreshCredentialDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
  {
    credentials: Account[];
    selectedCredentialName?: string;
  }
>;
export type PublishStartMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.PUBLISH_START>;
export type PublishFinishSuccessMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS>;
export type PublishFinishFailureMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.PUBLISH_FINISH_FAILURE,
  {
    data: {
      message: string;
    };
  }
>;
export type UpdateDeploymentSelectionMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_DEPLOYMENT_SELECTION,
  {
    preDeployment: PreDeployment;
    saveSelection?: boolean;
  }
>;
export type UpdateConfigSelectionMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_CONFIG_SELECTION,
  {
    config: Configuration;
    saveSelection?: boolean;
  }
>;
export type SaveSelectionMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.SAVE_SELECTION>;

export type RefreshFilesListsMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_FILES_LISTS,
  {
    includedFiles: DeploymentFile[];
    excludedFiles: DeploymentFile[];
  }
>;

export type UpdatePythonPackages = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES,
  {
    file?: string;
    manager?: string;
    packages?: string[];
  }
>;
