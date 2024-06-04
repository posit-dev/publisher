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
  RefreshFilesListsMsg,
  UpdateConfigSelectionMsg,
  UpdateContentRecordSelectionMsg,
  UpdatePythonPackages,
  UpdateRPackages,
} from "../../../src/types/messages/hostToWebviewMessages";
import {
  WebviewToHostMessage,
  WebviewToHostMessageType,
} from "../../../src/types/messages/webviewToHostMessages";
import { useHomeStore } from "./stores/home";

let _hostConduit: HostConduit | undefined = undefined;

const vsCodeApi = acquireVsCodeApi();

export function useHostConduitService() {
  if (!_hostConduit) {
    _hostConduit = new HostConduit(window, vsCodeApi);
    onMounted(() => _hostConduit && _hostConduit.onMsg(onMessageFromHost));
    onUnmounted(() => _hostConduit && _hostConduit.deactivate());
    _hostConduit.sendMsg({
      kind: WebviewToHostMessageType.INITIALIZING,
    });
  }

  const sendMsg = (msg: WebviewToHostMessage) => {
    if (!_hostConduit) {
      throw new Error(
        "HostCondiutService::sendMsg attemped ahead of call to useHostConduitService",
      );
    }
    console.debug(`HostConduitService - Sending Msg: ${JSON.stringify(msg)}`);
    return _hostConduit.sendMsg(msg);
  };

  return {
    sendMsg,
  };
}

const onMessageFromHost = (msg: HostToWebviewMessage): void => {
  console.debug(`HostConduitService - Receiving Msg: ${JSON.stringify(msg)}`);
  switch (msg.kind) {
    case HostToWebviewMessageType.REFRESH_CONTENTRECORD_DATA:
      return onRefreshContentRecordDataMsg(msg);
    case HostToWebviewMessageType.REFRESH_CONFIG_DATA:
      return onRefreshConfigDataMsg(msg);
    case HostToWebviewMessageType.REFRESH_CREDENTIAL_DATA:
      return onRefreshCredentialDataMsg(msg);
    case HostToWebviewMessageType.PUBLISH_START:
      return onPublishStartMsg();
    case HostToWebviewMessageType.PUBLISH_FINISH_SUCCESS:
      return onPublishFinishSuccessMsg();
    case HostToWebviewMessageType.PUBLISH_FINISH_FAILURE:
      return onPublishFinishFailureMsg(msg);
    case HostToWebviewMessageType.UPDATE_CONTENTRECORD_SELECTION:
      return onUpdateContentRecordSelectionMsg(msg);
    case HostToWebviewMessageType.UPDATE_CONFIG_SELECTION:
      return onUpdateConfigSelectionMsg(msg);
    case HostToWebviewMessageType.SAVE_SELECTION:
      return onSaveSelectionMsg();
    case HostToWebviewMessageType.REFRESH_FILES_LISTS:
      return onRefreshFilesListMsg(msg);
    case HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES:
      return onUpdatePythonPackages(msg);
    case HostToWebviewMessageType.UPDATE_R_PACKAGES:
      return onUpdateRPackages(msg);
    default:
      console.warn(`unexpected command: ${JSON.stringify(msg)}`);
  }
};

/**
 * When getting new contentRecords set the new name if given one,
 * unset the contentRecord if told to do so with null,
 * or keep the selected contentRecord with updated data.
 */
const onRefreshContentRecordDataMsg = (msg: RefreshContentRecordDataMsg) => {
  const home = useHomeStore();
  home.contentRecords = msg.content.contentRecords;

  const name = msg.content.selectedContentRecordName;
  if (name) {
    home.updateSelectedContentRecordByName(name);
  } else if (name === null) {
    home.selectedContentRecord = undefined;
  } else if (home.selectedContentRecord) {
    if (
      !home.updateSelectedContentRecordByName(
        home.selectedContentRecord.deploymentName,
      )
    ) {
      // Recalculate if the contentRecord object changed with new data
      home.updateCredentialsAndConfigurationForContentRecord();
    }
  }

  // If no contentRecord is selected, unset the selected configuration
  if (home.selectedContentRecord === undefined) {
    home.selectedConfiguration = undefined;
  }
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

  const name = msg.content.selectedConfigurationName;
  if (name) {
    home.updateSelectedConfigurationByName(name);
  } else if (name === null) {
    home.selectedConfiguration = undefined;
  } else if (home.selectedConfiguration) {
    home.updateSelectedConfigurationByName(
      home.selectedConfiguration.configurationName,
    );
  } else if (home.selectedContentRecord?.configurationName) {
    home.updateSelectedConfigurationByName(
      home.selectedContentRecord.configurationName,
    );
  }
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
const onPublishStartMsg = () => {
  const home = useHomeStore();
  home.publishInProgress = true;
};
const onPublishFinishSuccessMsg = () => {
  const home = useHomeStore();
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
const onUpdateContentRecordSelectionMsg = (
  msg: UpdateContentRecordSelectionMsg,
) => {
  const home = useHomeStore();
  home.updateSelectedContentRecordByObject(msg.content.preContentRecord);
  if (msg.content.saveSelection) {
    home.updateParentViewSelectionState();
  }
};
const onUpdateConfigSelectionMsg = (msg: UpdateConfigSelectionMsg) => {
  const home = useHomeStore();
  home.updateSelectedConfigurationByObject(msg.content.config);
  if (msg.content.saveSelection) {
    home.updateParentViewSelectionState();
  }
};
const onSaveSelectionMsg = () => {
  const home = useHomeStore();
  home.updateParentViewSelectionState();
};

const onRefreshFilesListMsg = (msg: RefreshFilesListsMsg) => {
  const home = useHomeStore();
  home.includedFiles = msg.content.includedFiles;
  home.excludedFiles = msg.content.excludedFiles;
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
