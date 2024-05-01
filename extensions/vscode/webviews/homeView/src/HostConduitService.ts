// Copyright (C) 2024 by Posit Software, PBC.

import { ref, onMounted, onUnmounted } from "vue";
import { HostConduit } from "./utils/hostConduit";
import {
  HostToWebviewMessage,
  HostToWebviewMessageType,
  PublishFinishFailureMsg,
  RefreshConfigDataMsg,
  RefreshCredentialDataMsg,
  RefreshDeploymentDataMsg,
  UpdateConfigSelectionMsg,
  UpdateDeploymentSelectionMsg,
  UpdateExpansionFromStorageMsg,
  UpdatePythonPackages,
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
    return _hostConduit.sendMsg(msg);
  };

  return {
    sendMsg,
  };
}

const onMessageFromHost = (msg: HostToWebviewMessage): void => {
  switch (msg.kind) {
    case HostToWebviewMessageType.REFRESH_DEPLOYMENT_DATA:
      return onRefreshDeploymentDataMsg(msg);
    case HostToWebviewMessageType.UPDATE_EXPANSION_FROM_STORAGE:
      return onUpdateExpansionFromStorageMsg(msg);
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
    case HostToWebviewMessageType.UPDATE_DEPLOYMENT_SELECTION:
      return onUpdateDeploymentSelectionMsg(msg);
    case HostToWebviewMessageType.UPDATE_CONFIG_SELECTION:
      return onUpdateConfigSelectionMsg(msg);
    case HostToWebviewMessageType.SAVE_SELECTION:
      return onSaveSelectionMsg();
    case HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES:
      return onUpdatePythonPackages(msg);
    default:
      console.log(`unexpected command: ${JSON.stringify(msg)}`);
  }
};

const onRefreshDeploymentDataMsg = (msg: RefreshDeploymentDataMsg) => {
  const home = useHomeStore();
  home.deployments = msg.content.deployments;
  if (msg.content.selectedDeploymentName) {
    home.updateSelectedDeploymentByName(msg.content.selectedDeploymentName);
  } else {
    if (
      !home.updateSelectedDeploymentByName(
        home.selectedDeployment?.deploymentName,
      )
    ) {
      // Always cause the re-calculation even if selected deployment didn't change
      home.updateCredentialsAndConfigurationForDeployment();
    }
  }
};
const onUpdateExpansionFromStorageMsg = (
  msg: UpdateExpansionFromStorageMsg,
) => {
  const home = useHomeStore();
  home.easyDeployExpanded = msg.content.expansionState;
};
const onRefreshConfigDataMsg = (msg: RefreshConfigDataMsg) => {
  const home = useHomeStore();
  home.configurations = msg.content.configurations;
  if (msg.content.selectedConfigurationName) {
    home.updateSelectedConfigurationByName(
      msg.content.selectedConfigurationName,
    );
  } else {
    home.updateSelectedConfigurationByName(
      home.selectedConfiguration?.configurationName,
    );
  }
};
const onRefreshCredentialDataMsg = (msg: RefreshCredentialDataMsg) => {
  const home = useHomeStore();
  home.credentials = msg.content.credentials;
  if (msg.content.selectedCredentialName) {
    home.updateSelectedCredentialByName(msg.content.selectedCredentialName);
  } else {
    home.updateSelectedCredentialByName(home.selectedCredential?.name);
  }
};
const onPublishStartMsg = () => {
  const home = useHomeStore();
  home.publishInProgress = true;
};
const onPublishFinishSuccessMsg = () => {
  const home = useHomeStore();
  home.publishInProgress = false;
  home.lastDeploymentResult = `Last deployment was succesful`;
  home.lastDeploymentMsg = "";
};
const onPublishFinishFailureMsg = (msg: PublishFinishFailureMsg) => {
  const home = useHomeStore();
  home.publishInProgress = false;
  home.lastDeploymentResult = `Last deployment failed`;
  home.lastDeploymentMsg = msg.content.data.message;
};
const onUpdateDeploymentSelectionMsg = (msg: UpdateDeploymentSelectionMsg) => {
  const home = useHomeStore();
  home.updateSelectedDeploymentByObject(msg.content.preDeployment);
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
const onUpdatePythonPackages = (msg: UpdatePythonPackages) => {
  const home = useHomeStore();
  home.updatePythonPackages({
    packages: msg.content.packages,
    file: msg.content.file,
    manager: msg.content.manager,
  });
};
