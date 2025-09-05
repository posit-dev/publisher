// Copyright (C) 2024 by Posit Software, PBC.

import { onMounted, onUnmounted } from "vue";
import { HostConduit } from "./utils/hostConduit";
import {
  HostToWebviewMessage,
  HostToWebviewMessageType,
  PublishFinishFailureMsg,
  RefreshConfigDataMsg,
  RefreshCredentialDataMsg,
  RefreshContentRecordDataMsg,
  UpdateContentRecordSelectionMsg,
  UpdatePythonPackages,
  UpdateRPackages,
  RefreshFilesMsg,
  SetPathSeparatorMsg,
  UpdateServerEnvironmentMsg,
  RefreshIntegrationRequestsMsg,
  RefreshServerSettingsMsg,
} from "../../../src/types/messages/hostToWebviewMessages";
import {
  WebviewToHostMessage,
  WebviewToHostMessageType,
} from "../../../src/types/messages/webviewToHostMessages";
import { useFileStore } from "src/stores/file";
import { useHomeStore } from "src/stores/home";
import { vscodeAPI } from "src/vscode";

let hostConduit: HostConduit | undefined = undefined;

const vsCodeApi = vscodeAPI();

export function useHostConduitService() {
  if (!hostConduit) {
    hostConduit = new HostConduit(window, vsCodeApi);
    onMounted(() => hostConduit && hostConduit.onMsg(onMessageFromHost));
    onUnmounted(() => hostConduit && hostConduit.deactivate());
    useHomeStore().initializingRequestComplete = false;
    hostConduit.sendMsg({
      kind: WebviewToHostMessageType.INITIALIZING,
    });
  }

  const sendMsg = (msg: WebviewToHostMessage) => {
    if (!hostConduit) {
      console.error(
        `HostCondiutService::sendMsg attempted ahead of call to useHostConduitService. Message Dropped: ${JSON.stringify(msg)}`,
      );
      return;
    }
    console.debug(`HostConduitService - Sending Msg: ${JSON.stringify(msg)}`);
    return hostConduit.sendMsg(msg);
  };

  return {
    sendMsg,
  };
}

const onMessageFromHost = (msg: HostToWebviewMessage): void => {
  console.debug(`HostConduitService - Receiving Msg: ${JSON.stringify(msg)}`);
  switch (msg.kind) {
    case HostToWebviewMessageType.INITIALIZING_REQUEST_COMPLETE:
      return onInitializingRequestCompleteMsg();
    case HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA:
      return onRefreshContentRecordDataMsg(msg);
    case HostToWebviewMessageType.REFRESH_CONFIG_DATA:
      return onRefreshConfigDataMsg(msg);
    case HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA:
      return onRefreshCredentialDataMsg(msg);
    case HostToWebviewMessageType.PUBLISH_CANCEL:
      return onPublishCancelMsg();
    case HostToWebviewMessageType.PUBLISH_INIT:
      return onPublishInitMsg();
    case HostToWebviewMessageType.PUBLISH_START:
      return onPublishStartMsg();
    case HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS:
      return onPublishFinishSuccessMsg();
    case HostToWebviewMessageType.PUBLISH_FINISH_FAILURE:
      return onPublishFinishFailureMsg(msg);
    case HostToWebviewMessageType.CONTENT_RENDER_FINISHED:
      return onContentRenderFinishedMsg();
    case HostToWebviewMessageType.CONTENT_RENDER_FAILURE:
      return onContentRenderFailureMsg();
    case HostToWebviewMessageType.UPDATE_CONTENTRECORD_SELECTION:
      return onUpdateContentRecordSelectionMsg(msg);
    case HostToWebviewMessageType.SAVE_SELECTION:
      return onSaveSelectionMsg();
    case HostToWebviewMessageType.REFRESH_FILES:
      return onRefreshFilesMsg(msg);
    case HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES:
      return onUpdatePythonPackages(msg);
    case HostToWebviewMessageType.UPDATE_R_PACKAGES:
      return onUpdateRPackages(msg);
    case HostToWebviewMessageType.SHOW_DISABLE_OVERLAY:
      return onShowDisableOverlayMsg();
    case HostToWebviewMessageType.HIDE_DISABLE_OVERLAY:
      return onHideDisableOverlayMsg();
    case HostToWebviewMessageType.SET_PATH_SEPARATOR:
      return onSetPathSeparatorMsg(msg);
    case HostToWebviewMessageType.UPDATE_SERVER_ENVIRONMENT:
      return onUpdateServerEnvironmentMsg(msg);
    case HostToWebviewMessageType.REFRESH_INTEGRATION_REQUESTS:
      return onRefreshIntegrationRequestsMsg(msg);
    case HostToWebviewMessageType.REFRESH_SERVER_SETTINGS:
      return onRefreshServerSettingsMsg(msg);
    default:
      console.warn(`unexpected command: ${JSON.stringify(msg)}`);
  }
};

const onSetPathSeparatorMsg = (msg: SetPathSeparatorMsg) => {
  useHomeStore().platformFileSeparator = msg.content.separator;
};

const onInitializingRequestCompleteMsg = () => {
  useHomeStore().initializingRequestComplete = true;
};

const onShowDisableOverlayMsg = () => {
  useHomeStore().showDisabledOverlay = true;
};

const onHideDisableOverlayMsg = () => {
  useHomeStore().showDisabledOverlay = false;
};

/**
 * When getting new contentRecords set the new name if given one,
 * unset the contentRecord if told to do so with null,
 * or keep the selected contentRecord with updated data.
 */
const onRefreshContentRecordDataMsg = (msg: RefreshContentRecordDataMsg) => {
  const home = useHomeStore();
  home.contentRecords = msg.content.contentRecords;

  const selector = msg.content.deploymentSelected;
  if (selector === null) {
    home.selectedContentRecord = undefined;
    return;
  }

  // If the selector is undefined don't change the selection, but update
  // the data
  if (selector === undefined) {
    if (home.selectedContentRecord) {
      home.updateSelectedContentRecordBySelector({
        deploymentPath: home.selectedContentRecord.deploymentPath,
        deploymentName: home.selectedContentRecord.deploymentName,
        projectDir: home.selectedContentRecord.projectDir,
      });
    }
    return;
  }

  // At this point we have a selector, so update the selection
  home.updateSelectedContentRecordBySelector(selector);
};

/**
 * When getting new configurations set the new name if given one,
 * unset the configuration if told to do so with null,
 * keep the selected configuration with updated data,
 * or set the selected configuration to the one from the selected contentRecord.
 */
const onRefreshConfigDataMsg = (msg: RefreshConfigDataMsg) => {
  const home = useHomeStore();
  home.configurations = msg.content.configurations;
  home.configurationsInError = msg.content.configurationsInError;
};

/**
 * When getting new credentials set the new name if given one,
 * unset the credential if told to do so with null,
 * or keep the selected credential with updated data.
 */
const onRefreshCredentialDataMsg = (msg: RefreshCredentialDataMsg) => {
  const home = useHomeStore();
  home.credentials = msg.content.credentials;
};
const onPublishCancelMsg = () => {
  const home = useHomeStore();
  home.publishInProgress = false;
  home.publishInitiated = false;
};
const onPublishInitMsg = () => {
  const home = useHomeStore();
  home.publishInitiated = false;
};
const onPublishStartMsg = () => {
  const home = useHomeStore();
  home.publishInProgress = true;
};
const onPublishFinishSuccessMsg = () => {
  const home = useHomeStore();
  home.clearSecretValues();
  home.publishInProgress = false;
  home.lastContentRecordResult = `Last Deployment was Successful`;
  home.lastContentRecordMsg = "";
};
const onPublishFinishFailureMsg = (msg: PublishFinishFailureMsg) => {
  const home = useHomeStore();
  home.publishInProgress = false;
  home.lastContentRecordResult = `Last Deployment Failed`;
  home.lastContentRecordMsg = msg.content.data.message;
};
const onContentRenderFinishedMsg = () => {
  const home = useHomeStore();
  home.contentRenderInProgress = false;
  console.log("MESSAGE RECEIVED, render in progress set to false");
};
const onContentRenderFailureMsg = () => {
  const home = useHomeStore();
  home.contentRenderFailed = true;
};
const onUpdateContentRecordSelectionMsg = (
  msg: UpdateContentRecordSelectionMsg,
) => {
  const home = useHomeStore();
  home.updateSelectedContentRecordByObject(msg.content.preContentRecord);
  if (msg.content.saveSelection) {
    home.updateParentViewSelectionState();
  }
};

const onSaveSelectionMsg = () => {
  const home = useHomeStore();
  home.updateParentViewSelectionState();
};

const onRefreshFilesMsg = (msg: RefreshFilesMsg) => {
  const fileStore = useFileStore();

  // If the root file has changed, reset the expanded directories
  if (msg.content.files.abs !== fileStore.files?.abs) {
    fileStore.expandedDirs = new Set();
  }

  fileStore.files = msg.content.files;
};

const onUpdatePythonPackages = (msg: UpdatePythonPackages) => {
  const home = useHomeStore();
  home.updatePythonPackages(
    msg.content.pythonProject,
    msg.content.packages,
    msg.content.file,
    msg.content.manager,
  );
};

const onUpdateRPackages = (msg: UpdateRPackages) => {
  const home = useHomeStore();
  home.updateRPackages(
    msg.content.rProject,
    msg.content.packages,
    msg.content.file,
    msg.content.manager,
    msg.content.rVersion,
  );
};

const onUpdateServerEnvironmentMsg = (msg: UpdateServerEnvironmentMsg) => {
  const home = useHomeStore();
  home.serverSecrets = new Set(msg.content.environment);
};

const onRefreshIntegrationRequestsMsg = (
  msg: RefreshIntegrationRequestsMsg,
) => {
  const home = useHomeStore();
  home.integrationRequests = msg.content.integrationRequests;
};

const onRefreshServerSettingsMsg = (msg: RefreshServerSettingsMsg) => {
  const home = useHomeStore();
  home.serverSettings = msg.content.serverSettings;
};
