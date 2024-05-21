// Copyright (C) 2024 by Posit Software, PBC.

import { RPackage } from "../../api/types/packages";
import {
  Credential,
  Configuration,
  Deployment,
  DeploymentFile,
  PreDeployment,
  ConfigurationError,
} from "../../api";

export enum HostToWebviewMessageType {
  // Sent from host to webviewView
  REFRESH_DEPLOYMENT_DATA = "refreshDeploymentData",
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
  UPDATE_R_PACKAGES = "updateRPackages",
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
  | RefreshConfigDataMsg
  | RefreshCredentialDataMsg
  | PublishStartMsg
  | PublishFinishSuccessMsg
  | PublishFinishFailureMsg
  | UpdateDeploymentSelectionMsg
  | UpdateConfigSelectionMsg
  | SaveSelectionMsg
  | RefreshFilesListsMsg
  | UpdatePythonPackages
  | UpdateRPackages;

export function isHostToWebviewMessage(msg: any): msg is HostToWebviewMessage {
  return (
    msg.kind === HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA ||
    msg.kind === HostToWebviewMessageType.REFRESH_CONFIG_DATA ||
    msg.kind === HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA ||
    msg.kind === HostToWebviewMessageType.PUBLISH_START ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_FAILURE ||
    msg.kind === HostToWebviewMessageType.UPDATE_DEPLOYMENT_SELECTION ||
    msg.kind === HostToWebviewMessageType.UPDATE_CONFIG_SELECTION ||
    msg.kind === HostToWebviewMessageType.SAVE_SELECTION ||
    msg.kind === HostToWebviewMessageType.REFRESH_FILES_LISTS ||
    msg.kind === HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES ||
    msg.kind === HostToWebviewMessageType.UPDATE_R_PACKAGES
  );
}

export type RefreshDeploymentDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA,
  {
    deployments: (Deployment | PreDeployment)[];
    selectedDeploymentName?: string | null;
  }
>;
export type RefreshConfigDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CONFIG_DATA,
  {
    configurations: Configuration[];
    configurationsInError: ConfigurationError[];
    selectedConfigurationName?: string | null;
  }
>;
export type RefreshCredentialDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA,
  {
    credentials: Credential[];
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
    pythonProject: boolean;
    file?: string;
    manager?: string;
    packages?: string[];
  }
>;

export type UpdateRPackages = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_R_PACKAGES,
  {
    rProject: boolean;
    file?: string;
    manager?: string;
    rVersion?: string;
    packages?: RPackage[];
  }
>;
