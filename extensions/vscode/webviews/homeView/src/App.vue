<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
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
          class="dropdowns"
        />
      </div>
      <div>
        <div class="label-and-icons">
          <label for="config-selector">Configuration:</label>
          <div class="action-icons-container">
            <vscode-button
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
          class="dropdowns"
        />
      </div>

      <label for="credentials-selector">Credentials:</label>
      <PSelect
        v-model="selectedAccount"
        :options="filteredAccounts"
        :get-key="(a: Account) => a.name"
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
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from "vue";
import PSelect from "./components/PSelect.vue";
import {
  Deployment,
  PreDeployment,
  isPreDeployment,
} from "../../../src/api/types/deployments";
import { formatDateString } from "../../../../../web/src/utils/date";
import { Account } from "../../../src/api/types/accounts";
import { Configuration } from "../../../src/api/types/configurations";

let deployments = ref<(Deployment | PreDeployment)[]>([]);
let configs = ref<Configuration[]>([]);
let accounts = ref<Account[]>([]);
let filteredAccounts = ref<Account[]>([]);
let publishingInProgress = ref(false);

const selectedDeployment = ref<Deployment | PreDeployment>();
const selectedConfig = ref<Configuration>();
const selectedAccount = ref<Account>();

const lastDeploymentResult = ref<string>();
const lastDeploymentMsg = ref<string>();

const showDetails = ref(false);

const vsCodeApi = acquireVsCodeApi();

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

watch(selectedDeployment, () => {
  filterCredentialsToDeployment(selectedAccount.value);
});

onBeforeMount(() => {
  // Register for our messages from the provider
  window.addEventListener("message", onMessageFromProvider);

  // Send the message which will caue the provider to send us
  // our data back
  vsCodeApi.postMessage({
    command: "initializing",
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("message", onMessageFromProvider);
});

const updateSelectedDeploymentByObject = (
  preDeployment: PreDeployment,
): void => {
  deployments.value.push(preDeployment);
  selectedDeployment.value = preDeployment;
};

const updateSelectedDeploymentByName = (deploymentName?: string): void => {
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
};

const updateSelectedConfigurationByObject = (config: Configuration): void => {
  configs.value.push(config);
  selectedConfig.value = config;
};

const updateSelectedConfigurationByName = (configurationName?: string) => {
  let selectedConfigTarget: Configuration | undefined = undefined;
  if (selectedConfig.value) {
    selectedConfigTarget = configs.value.find(
      (config) => config.configurationName === configurationName,
    );
  }
  if (!selectedConfigTarget && configs.value.length) {
    selectedConfigTarget = configs.value[0];
  }
  selectedConfig.value = selectedConfigTarget;
};

// TODO: We need to show an error when you have no credentials which can get to
// the deployment URL
// OR
// Should we filter deployment list to just include what you can access. Maybe disable others?

const filterCredentialsToDeployment = (credentialName?: Account) => {
  filteredAccounts.value = accounts.value.filter((account) => {
    return (
      account.url.toLowerCase() ===
      selectedDeployment.value?.serverUrl.toLowerCase()
    );
  });

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

const onClickDeploy = () => {
  vsCodeApi.postMessage({
    command: "deploy",
    payload: JSON.stringify({
      deployment: selectedDeployment.value,
      configuration: selectedConfig.value,
      credential: selectedAccount.value,
    }),
  });
};

const onClickDeployExpand = () => {
  showDetails.value = !showDetails.value;
  if (showDetails.value) {
    vsCodeApi.postMessage({
      command: "expanded",
    });
  } else {
    vsCodeApi.postMessage({
      command: "collapsed",
    });
  }
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
    payload: selectedConfig.value,
  });
};

const onMessageFromProvider = (event: any) => {
  const command = event.data.command;
  switch (command) {
    case "refresh_data": {
      const payload = JSON.parse(event.data.payload);

      deployments.value = payload.deployments;
      updateSelectedDeploymentByName(selectedDeployment.value?.deploymentName);

      configs.value = payload.configurations;
      updateSelectedConfigurationByName(
        selectedConfig.value?.configurationName,
      );

      accounts.value = payload.credentials;
      filterCredentialsToDeployment(selectedAccount.value);

      break;
    }
    case "publish_start": {
      publishingInProgress.value = true;
      break;
    }
    case "publish_finish_success": {
      publishingInProgress.value = false;
      lastDeploymentResult.value = `Last deployment was succesful`;
      lastDeploymentMsg.value = "";
      break;
    }
    case "publish_finish_failure": {
      publishingInProgress.value = false;
      lastDeploymentResult.value = `Last deployment failed`;
      lastDeploymentMsg.value = event.data.payload.data.message;
      break;
    }
    case "update_deployment_selection": {
      const payload = JSON.parse(event.data.payload);
      if (payload.preDeployment) {
        updateSelectedDeploymentByObject(payload.preDeployment);
      }
      break;
    }
    case "update_config_selection": {
      const payload = JSON.parse(event.data.payload);
      updateSelectedConfigurationByObject(payload.config);
      break;
    }
    default:
      console.log(`unexpected command: ${command}`);
  }
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
