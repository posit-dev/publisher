// Copyright (C) 2024 by Posit Software, PBC.

import { onMounted, onUnmounted } from "vue";
import { HostConduit } from "./utils/hostConduit";
import {
  HostToWebviewMessage,
  HostToWebviewMessageType,
  PublishFinishFailureMsg,
  RefreshConfigDataMsg,
  RefreshCredentialDataMsg,
  RefreshDeploymentDataMsg,
  RefreshFilesListsMsg,
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
    case HostToWebviewMessageType.REFRESH_FILES_LISTS:
      return onRefreshFilesListMsg(msg);
    case HostToWebviewMessageType.UPDATE_PYTHON_PACKAGES:
      return onUpdatePythonPackages(msg);
    default:
      console.warn(`unexpected command: ${JSON.stringify(msg)}`);
  }
};

/**
 * When getting new deployments set the new name if given one,
 * unset the deployment if told to do so with null,
 * or keep the selected deployment with updated data.
 */
const onRefreshDeploymentDataMsg = (msg: RefreshDeploymentDataMsg) => {
  const home = useHomeStore();
  home.deployments = msg.content.deployments;

  const name = msg.content.selectedDeploymentName;
  if (name) {
    home.updateSelectedDeploymentByName(name);
  } else if (name === null) {
    home.selectedDeployment = undefined;
  } else if (home.selectedDeployment) {
    if (
      !home.updateSelectedDeploymentByName(
        home.selectedDeployment.deploymentName,
      )
    ) {
      // Recalculate if the deployment object changed with new data
      home.updateCredentialsAndConfigurationForDeployment();
    }
  }

  // If no deployment is selected, unset the selected configuration and credential
  if (home.selectedDeployment === undefined) {
    home.selectedConfiguration = undefined;
    home.selectedCredential = undefined;
  }
};

const onUpdateExpansionFromStorageMsg = (
  msg: UpdateExpansionFromStorageMsg,
) => {
  const home = useHomeStore();
  home.easyDeployExpanded = msg.content.expansionState;
};

/**
 * When getting new configurations set the new name if given one,
 * unset the configuration if told to do so with null,
 * keep the selected configuration with updated data,
 * or set the selected configuration to the one from the selected deployment.
 */
const onRefreshConfigDataMsg = (msg: RefreshConfigDataMsg) => {
  const home = useHomeStore();
  home.configurations = msg.content.configurations;

  const name = msg.content.selectedConfigurationName;
  if (name) {
    home.updateSelectedConfigurationByName(name);
  } else if (name === null) {
    home.selectedConfiguration = undefined;
  } else if (home.selectedConfiguration) {
    home.updateSelectedConfigurationByName(
      home.selectedConfiguration.configurationName,
    );
  } else if (home.selectedDeployment?.configurationName) {
    home.updateSelectedConfigurationByName(
      home.selectedDeployment.configurationName,
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

  const name = msg.content.selectedCredentialName;
  if (name) {
    home.updateSelectedCredentialByName(name);
  } else if (name === null) {
    home.selectedCredential = undefined;
  } else if (home.selectedCredential) {
    home.updateSelectedCredentialByName(home.selectedCredential.name);
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
