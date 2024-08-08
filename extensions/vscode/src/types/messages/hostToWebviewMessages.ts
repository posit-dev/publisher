// Copyright (C) 2024 by Posit Software, PBC.

import { RPackage } from "../../api/types/packages";
import {
  Credential,
  Configuration,
  ContentRecord,
  ContentRecordFile,
  PreContentRecord,
  ConfigurationError,
} from "../../api";
import { DeploymentSelector } from "../shared";

export enum HostToWebviewMessageType {
  // Sent from host to webviewView
  INITIALIZING_REQUEST_COMPLETE = "initializingRequestComplete",
  REFRESH_CONTENTRECORD_DATA = "refreshContentRecordData",
  REFRESH_CONFIG_DATA = "refreshConfigData",
  REFRESH_CREDENTIAL_DATA = "refreshCredentialData",
  PUBLISH_START = "publishStart",
  PUBLISH_FINISH_SUCCESS = "publishFinishSuccess",
  PUBLISH_FINISH_FAILURE = "publishFinishFailure",
  UPDATE_CONTENTRECORD_SELECTION = "updateContentRecordSelection",
  SAVE_SELECTION = "saveSelection",
  REFRESH_FILES = "refreshFiles",
  UPDATE_PYTHON_PACKAGES = "updatePythonPackages",
  UPDATE_R_PACKAGES = "updateRPackages",
  SHOW_DISABLE_OVERLAY = "showDisableOverlay",
  HIDE_DISABLE_OVERLAY = "hideDisableOverlay",
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
  | InitializingRequestComplete
  | RefreshContentRecordDataMsg
  | RefreshConfigDataMsg
  | RefreshCredentialDataMsg
  | PublishStartMsg
  | PublishFinishSuccessMsg
  | PublishFinishFailureMsg
  | UpdateContentRecordSelectionMsg
  | SaveSelectionMsg
  | RefreshFilesMsg
  | UpdatePythonPackages
  | UpdateRPackages
  | ShowDisableOverlayMsg
  | HideDisableOverlayMsg;

export function isHostToWebviewMessage(msg: any): msg is HostToWebviewMessage {
  return (
    msg.kind === HostToWebviewMessageType.INITIALIZING_REQUEST_COMPLETE ||
    msg.kind === HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA ||
    msg.kind === HostToWebviewMessageType.REFRESH_CONFIG_DATA ||
    msg.kind === HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA ||
    msg.kind === HostToWebviewMessageType.PUBLISH_START ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS ||
    msg.kind === HostToWebviewMessageType.PUBLISH_FINISH_FAILURE ||
    msg.kind === HostToWebviewMessageType.UPDATE_CONTENTRECORD_SELECTION ||
    msg.kind === HostToWebviewMessageType.SAVE_SELECTION ||
    msg.kind === HostToWebviewMessageType.REFRESH_FILES ||
    msg.kind === HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES ||
    msg.kind === HostToWebviewMessageType.UPDATE_R_PACKAGES ||
    msg.kind === HostToWebviewMessageType.SHOW_DISABLE_OVERLAY ||
    msg.kind === HostToWebviewMessageType.HIDE_DISABLE_OVERLAY
  );
}

export type InitializingRequestComplete =
  AnyHostToWebviewMessage<HostToWebviewMessageType.INITIALIZING_REQUEST_COMPLETE>;

export type RefreshContentRecordDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA,
  {
    contentRecords: (ContentRecord | PreContentRecord)[];
    deploymentSelected?: DeploymentSelector | null;
  }
>;
export type RefreshConfigDataMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_CONFIG_DATA,
  {
    configurations: Configuration[];
    configurationsInError: ConfigurationError[];
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
export type UpdateContentRecordSelectionMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.UPDATE_CONTENTRECORD_SELECTION,
  {
    preContentRecord: PreContentRecord;
    saveSelection?: boolean;
  }
>;
export type SaveSelectionMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.SAVE_SELECTION>;

export type RefreshFilesMsg = AnyHostToWebviewMessage<
  HostToWebviewMessageType.REFRESH_FILES,
  {
    files: ContentRecordFile;
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

export type ShowDisableOverlayMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.SHOW_DISABLE_OVERLAY>;

export type HideDisableOverlayMsg =
  AnyHostToWebviewMessage<HostToWebviewMessageType.HIDE_DISABLE_OVERLAY>;
