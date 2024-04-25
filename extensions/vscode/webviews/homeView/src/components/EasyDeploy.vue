<template>
  <div>
    <div class="roomy">
      <div class="deploy-combo-button">
        <vscode-button
          :disabled="disableDeployment"
          @click="onClickDeploy"
          style="
            flex: 2;
            border-top-right-radius: unset;
            border-bottom-right-radius: unset;
          "
        >
          Deploy Your Project
        </vscode-button>
        <vscode-button
          @click="onClickDeployExpand"
          style="
            border-top-left-radius: unset;
            border-bottom-left-radius: unset;
          "
          :aria-label="
            showDetails
              ? 'Collapse Deployment Selection Details'
              : 'Expand Deployment Selection Details'
          "
        >
          <span :class="buttonIconClass"></span>
        </vscode-button>
      </div>
    </div>
    <div v-if="showDetails">
      <div>
        <div class="label-and-icons">
          <label for="deployment-selector">Deployment:</label>
          <vscode-button
            appearance="icon"
            class="action-icons"
            aria-label="Add Deployment"
          >
            <span
              class="codicon codicon-add"
              @click="onClickAddDeployment"
            ></span>
          </vscode-button>
        </div>
        <PSelect
          v-model="selectedDeployment"
          :options="deployments"
          :get-key="(d) => d.saveName"
          @update:modelValue="onUpdateModelValueSelectedDeployment"
          class="dropdowns"
        />
      </div>
      <div>
        <div class="label-and-icons">
          <label for="config-selector">Configuration:</label>
          <div>
            <vscode-button
              v-if="selectedConfig"
              appearance="icon"
              class="action-icons"
              aria-label="Edit Selected Configuration"
            >
              <span
                class="codicon codicon-edit"
                @click="onClickEditConfiguration"
              ></span>
            </vscode-button>
            <vscode-button
              appearance="icon"
              class="action-icons"
              aria-label="Add Configuration"
            >
              <span
                class="codicon codicon-add"
                @click="onClickAddConfiguration"
              ></span>
            </vscode-button>
          </div>
        </div>
        <PSelect
          v-model="selectedConfig"
          :options="configs"
          :get-key="(c: Configuration) => c.configurationName"
          @update:modelValue="onUpdateModelValueSelectedConfig"
          class="dropdowns"
        />
      </div>
      <label for="credentials-selector">Credentials:</label>
      <PSelect
        v-model="selectedAccount"
        :options="filteredAccounts"
        :get-key="(a: Account) => a.name"
        @update:modelValue="onUpdateModelValueSelectedCredential"
        class="dropdowns"
      />
    </div>
    <div v-if="selectedDeployment && selectedDeployment.serverType">
      <vscode-divider />
      <div v-if="publishingInProgress" class="progress-container">
        <vscode-progress-ring class="progress-ring" />
        Deployment in Progress...
      </div>
      <div v-else>
        <h4 class="deployment-summary">
          {{ lastStatusDescription }}
        </h4>
        <div
          v-if="!isPreDeployment(selectedDeployment)"
          class="last-deployment-time"
        >
          {{ formatDateString(selectedDeployment.deployedAt) }}
        </div>
        <div
          v-if="selectedDeployment.deploymentError"
          class="last-deployment-details last-deployment-error"
        >
          <span class="codicon codicon-error error-icon"></span>
          <span class="error-message">
            Error: {{ selectedDeployment.deploymentError.msg }}
          </span>
        </div>
        <div class="last-deployment-details">
          Targeting Posit Connect server at
          <a href="" @click="navigateToUrl(selectedDeployment.serverUrl)">{{
            selectedDeployment.serverUrl
          }}</a>
        </div>
        <div
          v-if="!isPreDeployment(selectedDeployment)"
          class="last-deployment-details"
        >
          <vscode-button
            appearance="secondary"
            @click="navigateToUrl(selectedDeployment.dashboardUrl)"
            class="dashboard-button"
            >View Content
          </vscode-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref } from "vue";

import { formatDateString } from "../../../../../../web/src/utils/date";
import {
  Deployment,
  PreDeployment,
  isPreDeployment,
} from "../../../../src/api/types/deployments";
import { Account } from "../../../../src/api/types/accounts";
import { Configuration } from "../../../../src/api/types/configurations";
import { HostConduit } from "../hostConduit";

import PSelect from "./PSelect.vue";
import {
  ConduitMessage,
  MessageType,
  PublishFinishFailureMsg,
  RefreshConfigDataMsg,
  RefreshCredentialDataMsg,
  RefreshDeploymentDataMsg,
  UpdateConfigSelectionMsg,
  UpdateDeploymentSelectionMsg,
  UpdateExpansionFromStorageMsg,
} from "../../../../src/messages";

let deployments = ref<(Deployment | PreDeployment)[]>([]);
let configs = ref<Configuration[]>([]);
let accounts = ref<Account[]>([]);
let publishingInProgress = ref(false);

const selectedDeployment = ref<Deployment | PreDeployment>();
const selectedConfig = ref<Configuration>();
const selectedAccount = ref<Account>();

const lastDeploymentResult = ref<string>();
const lastDeploymentMsg = ref<string>();

const showDetails = ref(false);

const vsCodeApi = acquireVsCodeApi();
const hostConduit = new HostConduit(window, vsCodeApi);

const lastStatusDescription = computed(() => {
  if (!selectedDeployment.value) {
    return undefined;
  }
  if (selectedDeployment.value.deploymentError) {
    return "Last Deployment Failed";
  }
  if (isPreDeployment(selectedDeployment.value)) {
    return "Not Yet Deployed";
  }
  return "Last Deployment Successful";
});

const buttonIconClass = computed(() => {
  return showDetails.value
    ? "codicon codicon-chevron-down"
    : "codicon codicon-chevron-right";
});

const disableDeployment = computed(() => {
  const result =
    !Boolean(selectedDeployment.value) ||
    !Boolean(selectedConfig.value) ||
    !Boolean(selectedAccount.value);
  return result;
});

const onUpdateModelValueSelectedDeployment = () => {
  updateCredentialsAndConfigurationForDeployment();
  updateParentViewSelectionState();
};

const updateCredentialsAndConfigurationForDeployment = () => {
  filterCredentialsToDeployment();
  if (selectedDeployment.value?.configurationName) {
    updateSelectedConfigurationByName(
      selectedDeployment.value.configurationName,
    );
  }
};

const onUpdateModelValueSelectedConfig = () => {
  updateParentViewSelectionState();
};

const onUpdateModelValueSelectedCredential = () => {
  updateParentViewSelectionState();
};

onBeforeMount(() => {
  // establish our message handler for messages from our host
  hostConduit.onMsg(onMessageFromHost);

  // Send the message which will caue the provider to send us
  // our data back
  vsCodeApi.postMessage({
    command: "initializing",
  });
});

onBeforeUnmount(() => {
  hostConduit.deactivate();
});

const updateSelectedDeploymentByObject = (
  preDeployment: PreDeployment,
): void => {
  deployments.value.push(preDeployment);
  selectedDeployment.value = preDeployment;
};

const updateSelectedDeploymentByName = (deploymentName?: string): boolean => {
  const previousSelectedDeployment = selectedDeployment.value;
  let selectedDeploymentTarget: Deployment | PreDeployment | undefined =
    undefined;
  if (deploymentName) {
    selectedDeploymentTarget = deployments.value.find(
      (deployment) => deployment.deploymentName === deploymentName,
    );
  }
  if (!selectedDeploymentTarget && deployments.value.length) {
    selectedDeploymentTarget = deployments.value[0];
  }
  selectedDeployment.value = selectedDeploymentTarget;
  return previousSelectedDeployment === selectedDeployment.value;
};

const updateSelectedConfigurationByObject = (config: Configuration): void => {
  configs.value.push(config);
  selectedConfig.value = config;
};

const updateSelectedConfigurationByName = (
  configurationName?: string,
): boolean => {
  const previousSelectedConfig = selectedConfig.value;
  let selectedConfigTarget: Configuration | undefined = undefined;
  if (configurationName) {
    selectedConfigTarget = configs.value.find(
      (config) => config.configurationName === configurationName,
    );
  }
  if (!selectedConfigTarget && configs.value.length) {
    selectedConfigTarget = configs.value[0];
  }
  selectedConfig.value = selectedConfigTarget;
  return previousSelectedConfig === selectedConfig.value;
};

const updateSelectedCredentialByName = (credentialName?: string): boolean => {
  const previousSelectedAccount = selectedAccount.value;
  let selectedCredentialTarget: Account | undefined = undefined;
  if (credentialName) {
    selectedCredentialTarget = accounts.value.find(
      (account) => account.name === credentialName,
    );
  }
  if (!selectedCredentialTarget && accounts.value.length) {
    selectedCredentialTarget = accounts.value[0];
  }
  selectedAccount.value = selectedCredentialTarget;
  return previousSelectedAccount === selectedAccount.value;
};

const filteredAccounts = computed(() => {
  return accounts.value.filter((account) => {
    return (
      account.url.toLowerCase() ===
      selectedDeployment.value?.serverUrl.toLowerCase()
    );
  });
});

// TODO: We need to show an error when you have no credentials which can get to
// the deployment URL
// OR
// Should we filter deployment list to just include what you can access. Maybe disable others?

const filterCredentialsToDeployment = () => {
  if (filteredAccounts.value.length === 0) {
    // TODO: Show ERROR HERE!!!!
    selectedAccount.value = undefined;
  } else if (!selectedAccount.value) {
    selectedAccount.value = filteredAccounts.value[0];
  } else if (selectedAccount.value) {
    let targetAccount: Account | undefined = filteredAccounts.value.find(
      (account) => {
        if (selectedAccount.value) {
          return account.name === selectedAccount.value.name;
        }
        return false;
      },
    );
    if (targetAccount) {
      selectedAccount.value = targetAccount;
    } else {
      selectedAccount.value = filteredAccounts.value[0];
    }
  }
};

const onClickDeployExpand = () => {
  showDetails.value = !showDetails.value;
  vsCodeApi.postMessage({
    command: "saveDeploymentButtonExpanded",
    payload: JSON.stringify(showDetails.value),
  });
};

const updateParentViewSelectionState = () => {
  vsCodeApi.postMessage({
    command: "saveSelectionState",
    payload: JSON.stringify({
      deploymentName: selectedDeployment.value?.saveName,
      configurationName: selectedConfig.value?.configurationName,
      credentialName: selectedAccount.value?.name,
    }),
  });
};

const onClickDeploy = () => {
  vsCodeApi.postMessage({
    command: "deploy",
    payload: JSON.stringify({
      deployment: selectedDeployment.value?.saveName,
      configuration: selectedConfig.value?.configurationName,
      credential: selectedAccount.value?.name,
    }),
  });
};

const navigateToUrl = (url: string) => {
  vsCodeApi.postMessage({
    command: "navigate",
    payload: url,
  });
};

const onClickAddDeployment = () => {
  vsCodeApi.postMessage({
    command: "newDeployment",
  });
};

const onClickAddConfiguration = () => {
  vsCodeApi.postMessage({
    command: "newConfiguration",
  });
};

const onClickEditConfiguration = () => {
  vsCodeApi.postMessage({
    command: "editConfiguration",
    payload: selectedConfig.value?.configurationName,
  });
};

const onMessageFromHost = async (msg: ConduitMessage) => {
  switch (msg.kind) {
    case MessageType.REFRESH_DEPLOYMENT_DATA:
      return await onRefreshDeploymentDataMsg(msg);
    case MessageType.UPDATE_EXPANSION_FROM_STORAGE:
      return await onUpdateExpansionFromStorageMsg(msg);
    case MessageType.REFRESH_CONFIG_DATA:
      return await onRefreshConfigDataMsg(msg);
    case MessageType.REFRESH_CREDENTIAL_DATA:
      return await onRefreshCredentialDataMsg(msg);
    case MessageType.PUBLISH_START:
      return await onPublishStartMsg();
    case MessageType.PUBLISH_FINISH_SUCCESS:
      return await onPublishFinishSuccessMsg();
    case MessageType.PUBLISH_FINISH_FAILURE:
      return await onPublishFinishFailureMsg(msg);
    case MessageType.UPDATE_DEPLOYMENT_SELECTION:
      return await onUpdateDeploymentSelectionMsg(msg);
    case MessageType.UPDATE_CONFIG_SELECTION:
      return await onUpdateConfigSelectionMsg(msg);
    case MessageType.SAVE_SELECTION:
      return await onSaveSelectionMsg();
    default:
      console.log(`unexpected command: ${JSON.stringify(msg)}`);
  }
};

const onRefreshDeploymentDataMsg = (msg: RefreshDeploymentDataMsg) => {
  deployments.value = msg.content.deployments;
  // if (payload.selectedDeploymentName) {
  //   updateSelectedDeploymentByName(msg.content.selectedDeploymentName);
  // } else {
  if (
    !updateSelectedDeploymentByName(selectedDeployment.value?.deploymentName)
  ) {
    // Always cause the re-calculation even if selected deployment didn't change
    updateCredentialsAndConfigurationForDeployment();
  }
  // }
};

const onUpdateExpansionFromStorageMsg = (
  msg: UpdateExpansionFromStorageMsg,
) => {
  showDetails.value = msg.content.expansionState;
};

const onRefreshConfigDataMsg = (msg: RefreshConfigDataMsg) => {
  configs.value = msg.content.configurations;

  // if (payload.selectedConfigurationName) {
  //   updateSelectedConfigurationByName(payload.selectedConfigurationName);
  // } else {
  updateSelectedConfigurationByName(selectedConfig.value?.configurationName);
  // }
};

const onRefreshCredentialDataMsg = (msg: RefreshCredentialDataMsg) => {
  accounts.value = msg.content.credentials;
  // if (payload.selectedCredentialName) {
  //   updateSelectedCredentialByName(payload.selectedCredentialName);
  // } else {
  updateSelectedCredentialByName(selectedAccount.value?.name);
  // }
};

const onPublishStartMsg = () => {
  publishingInProgress.value = true;
};

const onPublishFinishSuccessMsg = () => {
  publishingInProgress.value = false;
  lastDeploymentResult.value = `Last deployment was succesful`;
  lastDeploymentMsg.value = "";
};

const onPublishFinishFailureMsg = (msg: PublishFinishFailureMsg) => {
  publishingInProgress.value = false;
  lastDeploymentResult.value = `Last deployment failed`;
  lastDeploymentMsg.value = msg.content.data.message;
};

const onUpdateDeploymentSelectionMsg = (msg: UpdateDeploymentSelectionMsg) => {
  updateSelectedDeploymentByObject(msg.content.preDeployment);
  if (msg.content.saveSelection) {
    updateParentViewSelectionState();
  }
};

const onUpdateConfigSelectionMsg = (msg: UpdateConfigSelectionMsg) => {
  updateSelectedConfigurationByObject(msg.content.config);
  if (msg.content.saveSelection) {
    updateParentViewSelectionState();
  }
};

const onSaveSelectionMsg = () => {
  updateParentViewSelectionState();
};
</script>

<style lang="scss" scoped>
.roomy {
  margin: 0.5rem 0;
}

.dropdowns {
  display: block;
  margin: 0.5rem 0 1rem 0;
}

.label-and-icons {
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
}

.deployment-summary {
  margin-bottom: 5px;
}

.last-deployment-time {
  margin-bottom: 20px;
}

.last-deployment-details {
  margin-top: 10px;
}

.last-deployment-error {
  border: solid 2px;
  border-color: gray;
  padding: 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-icon {
  flex: 0;
}

.error-message {
  margin-left: 5px;
}

.deploy-combo-button {
  display: flex;
  min-width: 100%;
}

.progress-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 10px;
}

.progress-ring {
  margin-right: 10px;
}

.dashboard-button {
  width: 100%;
  margin-top: 10px;
}
</style>
