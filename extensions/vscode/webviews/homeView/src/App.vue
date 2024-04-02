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
          :disabled="disableDeployment"
          @click="onClickDeployExpand"
          style="
            border-top-left-radius: unset;
            border-bottom-left-radius: unset;
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
          <vscode-button appearance="icon" class="action-icons">
            <span
              class="codicon codicon-add"
              @click="onClickAddDeployment"
            ></span>
          </vscode-button>
        </div>
        <vscode-dropdown
          id="deployment-selector"
          v-model="selectedDeploymentName"
          class="dropdowns"
        >
          <vscode-option
            v-for="deployment in deploymentList"
            :key="deployment"
            :selected="deployment === selectedDeploymentName"
          >
            {{ deployment }}
          </vscode-option>
        </vscode-dropdown>
      </div>

      <div>
        <div class="label-and-icons">
          <label for="config-selector">Configuration:</label>
          <div class="action-icons-container">
            <vscode-button appearance="icon" class="action-icons">
              <span
                class="codicon codicon-edit"
                @click="onClickEditConfiguration"
              ></span>
            </vscode-button>
            <vscode-button appearance="icon" class="action-icons">
              <span
                class="codicon codicon-add"
                @click="onClickAddConfiguration"
              ></span>
            </vscode-button>
          </div>
        </div>
        <vscode-dropdown
          id="config-selector"
          v-model="selectedConfig"
          class="dropdowns"
        >
          <vscode-option v-for="config in configList" :key="config">{{
            config
          }}</vscode-option>
        </vscode-dropdown>
      </div>

      <label for="credentials-selector">Credentials:</label>
      <vscode-dropdown
        id="credentials-selector"
        v-model="selectedCredential"
        class="dropdowns"
      >
        <vscode-option v-for="credential in credentialList" :key="credential">{{
          credential
        }}</vscode-option>
      </vscode-dropdown>
    </div>
    <div v-if="selectedDeployment && selectedDeployment.serverType">
      <vscode-divider />
      <div v-if="publishingInProgress" class="progress-container">
        <vscode-progress-ring class="progress-ring" />
        Deployment in Progress...
      </div>
      <div v-if="!publishingInProgress">
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
          <a
            href=""
            onclick="onNavigateToServer(selectedDeployment.serverUrl)"
            >{{ selectedDeployment.serverUrl }}</a
          >
        </div>
        <div
          v-if="!isPreDeployment(selectedDeployment)"
          class="last-deployment-details"
        >
          <vscode-button
            appearance="secondary"
            @click="onClickDashboardUrl(selectedDeployment.dashboardUrl)"
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
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeProgressRing,
  vsCodeDivider,
} from "@vscode/webview-ui-toolkit";
import {
  Deployment,
  PreDeployment,
  isPreDeployment,
  isDeployment,
} from "../../../src/api/types/deployments";
import { formatDateString } from "../../../../../web/src/utils/date";
import { Account } from "../../../src/api/types/accounts";

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeProgressRing(),
  vsCodeDivider(),
);

// need access to the global window variable
// in order to access addEventListener
declare var window: any;

let deployments = ref<(Deployment | PreDeployment)[]>([]);
let deploymentList = ref<string[]>([]);
let configList = ref<string[]>([]);
let accounts = ref<Account[]>([]);
let credentialList = ref<string[]>([]);
let publishingInProgress = ref(false);

const selectedDeploymentName = ref<string>();
const selectedDeployment = ref<Deployment | PreDeployment | undefined>(
  undefined,
);
const selectedConfig = ref<string>();
const selectedCredential = ref<string>();
const lastDeploymentSuccessful = ref<boolean | undefined>(undefined);
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
  console.log(
    `selectedDeploymentName: ${selectedDeploymentName.value}: ${!Boolean(selectedDeploymentName.value)}`,
  );
  console.log(
    `selectedConfig: ${selectedConfig.value}: ${!Boolean(selectedConfig.value)}`,
  );
  console.log(
    `selectedCredential: ${selectedCredential.value}: ${!Boolean(selectedCredential.value)}`,
  );
  const result =
    !Boolean(selectedDeploymentName.value) ||
    !Boolean(selectedConfig.value) ||
    !Boolean(selectedCredential.value);
  console.log(`disableDeployment: ${result}`);
  return result;
});

watch(selectedDeploymentName, () => {
  updateSelectedDevelopment();
  filterCredentialsToDeployment();
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

const updateSelectedDevelopment = () => {
  selectedDeployment.value = deployments.value.find(
    (deployment) => deployment.saveName === selectedDeploymentName.value,
  );
};

// TODO: We need to show an error when you have no credentials which can get to
// the deployment URL
// OR
// Should we filter deployment list to just include what you can access. Maybe disable others?

const filterCredentialsToDeployment = () => {
  credentialList.value = accounts.value
    .filter((account) => {
      return (
        account.url.toLowerCase() ===
        selectedDeployment.value?.serverUrl.toLocaleLowerCase()
      );
    })
    .map((account) => account.name);

  if (credentialList.value.length === 0) {
    // TODO: Show ERROR HERE!!!!
    selectedCredential.value = "";
  } else if (!selectedCredential.value) {
    selectedCredential.value = credentialList.value[0];
  } else if (!credentialList.value.includes(selectedCredential.value)) {
    selectedCredential.value = credentialList.value[0];
  }
};

const onClickDeploy = () => {
  vsCodeApi.postMessage({
    command: "deploy",
    payload: JSON.stringify({
      deployment: selectedDeploymentName.value,
      configuration: selectedConfig.value,
      credential: selectedCredential.value,
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

const onClickDashboardUrl = (url: string) => {
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
      deploymentList.value = deployments.value.map(
        (deployment) => deployment.saveName,
      );
      if (selectedDeploymentName.value) {
        if (!deploymentList.value.includes(selectedDeploymentName.value)) {
          selectedDeploymentName.value = "";
        }
      }

      if (!selectedDeploymentName.value) {
        selectedDeploymentName.value = deploymentList.value[0];
      }
      updateSelectedDevelopment();

      configList.value = payload.configurations;
      if (!selectedConfig.value) {
        selectedConfig.value = configList.value[0];
      }
      if (configList.value.length === 0) {
        selectedConfig.value = "";
      }

      accounts.value = payload.credentials;
      filterCredentialsToDeployment();

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
      // Not sure why we can't set this value immediately, even ahead
      // of the refresh which is coming, but what I've found is that you
      // have to wait long enough for the list to render before setting it,
      // otherwise the selector will select the first value in the list.
      // (I've even tried holding off on setting the value until the next refresh
      // comes in, which has the new value included).
      setTimeout(() => {
        selectedDeploymentName.value = payload.name;
      }, 1000);
      break;
    }
    case "update_config_selection": {
      const payload = JSON.parse(event.data.payload);
      // Not sure why we can't set this value immediately, even ahead
      // of the refresh which is coming, but what I've found is that you
      // have to wait long enough for the list to render before setting it,
      // otherwise the selector will select the first value in the list.
      // (I've even tried holding off on setting the value until the next refresh
      // comes in, which has the new value included).
      setTimeout(() => {
        selectedConfig.value = payload.name;
      }, 1000);
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
