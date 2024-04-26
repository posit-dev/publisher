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
          v-model="home.selectedDeployment"
          :options="home.deployments"
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
              v-if="home.selectedConfiguration"
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
          v-model="home.selectedConfiguration"
          :options="home.configurations"
          :get-key="(c: Configuration) => c.configurationName"
          @update:modelValue="onUpdateModelValueSelectedConfig"
          class="dropdowns"
        />
      </div>
      <label for="credentials-selector">Credentials:</label>
      <PSelect
        v-model="home.selectedCredential"
        :options="home.filteredCredentials"
        :get-key="(a: Account) => a.name"
        @update:modelValue="onUpdateModelValueSelectedCredential"
        class="dropdowns"
      />
    </div>
    <div v-if="home.selectedDeployment && home.selectedDeployment.serverType">
      <vscode-divider />
      <div v-if="home.publishInProgress" class="progress-container">
        <vscode-progress-ring class="progress-ring" />
        Deployment in Progress...
      </div>
      <div v-else>
        <h4 class="deployment-summary">
          {{ lastStatusDescription }}
        </h4>
        <div
          v-if="!isPreDeployment(home.selectedDeployment)"
          class="last-deployment-time"
        >
          {{ formatDateString(home.selectedDeployment.deployedAt) }}
        </div>
        <div
          v-if="home.selectedDeployment.deploymentError"
          class="last-deployment-details last-deployment-error"
        >
          <span class="codicon codicon-error error-icon"></span>
          <span class="error-message">
            Error: {{ home.selectedDeployment.deploymentError.msg }}
          </span>
        </div>
        <div class="last-deployment-details">
          Targeting Posit Connect server at
          <a
            href=""
            @click="navigateToUrl(home.selectedDeployment.serverUrl)"
            >{{ home.selectedDeployment.serverUrl }}</a
          >
        </div>
        <div
          v-if="!isPreDeployment(home.selectedDeployment)"
          class="last-deployment-details"
        >
          <vscode-button
            appearance="secondary"
            @click="navigateToUrl(home.selectedDeployment.dashboardUrl)"
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
import { isPreDeployment } from "../../../../src/api/types/deployments";
import { Account } from "../../../../src/api/types/accounts";
import { Configuration } from "../../../../src/api/types/configurations";
import { useHomeStore } from "../stores/home";

import PSelect from "./PSelect.vue";

const home = useHomeStore();

const lastDeploymentResult = ref<string>();
const lastDeploymentMsg = ref<string>();

const showDetails = ref(false);

const vsCodeApi = acquireVsCodeApi();

const lastStatusDescription = computed(() => {
  if (!home.selectedDeployment) {
    return undefined;
  }
  if (home.selectedDeployment.deploymentError) {
    return "Last Deployment Failed";
  }
  if (isPreDeployment(home.selectedDeployment)) {
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
    !Boolean(home.selectedDeployment) ||
    !Boolean(home.selectedConfiguration) ||
    !Boolean(home.selectedCredential);
  return result;
});

const onUpdateModelValueSelectedDeployment = () => {
  updateCredentialsAndConfigurationForDeployment();
  updateParentViewSelectionState();
};

const updateCredentialsAndConfigurationForDeployment = () => {
  filterCredentialsToDeployment();
  if (home.selectedDeployment?.configurationName) {
    home.updateSelectedConfigurationByName(
      home.selectedDeployment.configurationName,
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

// TODO: We need to show an error when you have no credentials which can get to
// the deployment URL
// OR
// Should we filter deployment list to just include what you can access. Maybe disable others?

const filterCredentialsToDeployment = () => {
  if (home.filteredCredentials.length === 0) {
    // TODO: Show ERROR HERE!!!!
    home.selectedCredential = undefined;
  } else if (!home.selectedCredential) {
    home.selectedCredential = home.filteredCredentials[0];
  } else if (home.selectedCredential) {
    let targetAccount: Account | undefined = home.filteredCredentials.find(
      (account) => {
        if (home.selectedCredential) {
          return account.name === home.selectedCredential.name;
        }
        return false;
      },
    );
    if (targetAccount) {
      home.selectedCredential = targetAccount;
    } else {
      home.selectedCredential = home.filteredCredentials[0];
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
      deploymentName: home.selectedDeployment?.saveName,
      configurationName: home.selectedConfiguration?.configurationName,
      credentialName: home.selectedCredential?.name,
    }),
  });
};

const onClickDeploy = () => {
  vsCodeApi.postMessage({
    command: "deploy",
    payload: JSON.stringify({
      deployment: home.selectedDeployment?.saveName,
      configuration: home.selectedConfiguration?.configurationName,
      credential: home.selectedCredential?.name,
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
    payload: home.selectedConfiguration?.configurationName,
  });
};

const onMessageFromProvider = (event: any) => {
  const command = event.data.command;
  switch (command) {
    case "refresh_deployment_data": {
      const payload = JSON.parse(event.data.payload);
      home.deployments = payload.deployments;
      if (payload.selectedDeploymentName) {
        home.updateSelectedDeploymentByName(payload.selectedDeploymentName);
      } else {
        if (
          !home.updateSelectedDeploymentByName(
            home.selectedDeployment?.deploymentName,
          )
        ) {
          // Always cause the re-calculation even if selected deployment didn't change
          updateCredentialsAndConfigurationForDeployment();
        }
      }
      break;
    }
    case "update_expansion_from_storage": {
      const payload = JSON.parse(event.data.payload);
      showDetails.value = payload.expansionState;
      break;
    }
    case "refresh_config_data": {
      const payload = JSON.parse(event.data.payload);
      home.configurations = payload.configurations;
      if (payload.selectedConfigurationName) {
        home.updateSelectedConfigurationByName(
          payload.selectedConfigurationName,
        );
      } else {
        home.updateSelectedConfigurationByName(
          home.selectedConfiguration?.configurationName,
        );
      }
      break;
    }
    case "refresh_credential_data": {
      const payload = JSON.parse(event.data.payload);
      home.credentials = payload.credentials;
      if (payload.selectedCredentialName) {
        home.updateSelectedCredentialByName(payload.selectedCredentialName);
      } else {
        home.updateSelectedCredentialByName(home.selectedCredential?.name);
      }
      break;
    }
    case "publish_start": {
      home.publishInProgress = true;
      break;
    }
    case "publish_finish_success": {
      home.publishInProgress = false;
      lastDeploymentResult.value = `Last deployment was succesful`;
      lastDeploymentMsg.value = "";
      break;
    }
    case "publish_finish_failure": {
      home.publishInProgress = false;
      lastDeploymentResult.value = `Last deployment failed`;
      lastDeploymentMsg.value = event.data.payload.data.message;
      break;
    }
    case "update_deployment_selection": {
      const payload = JSON.parse(event.data.payload);
      if (payload.preDeployment) {
        home.updateSelectedDeploymentByObject(payload.preDeployment);
      }
      if (payload.saveSelection) {
        updateParentViewSelectionState();
      }
      break;
    }
    case "update_config_selection": {
      const payload = JSON.parse(event.data.payload);
      if (payload.config) {
        home.updateSelectedConfigurationByObject(payload.config);
      }
      if (payload.saveSelection) {
        updateParentViewSelectionState();
      }
      break;
    }
    case "save_selection": {
      updateParentViewSelectionState();
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
