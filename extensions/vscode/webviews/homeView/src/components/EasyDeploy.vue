<template>
  <div>
    <div class="roomy">
      <ButtonDropdown
        class="deploy-button"
        :disabled="disableDeployment"
        :dropdown-label="
          home.easyDeployExpanded
            ? 'Collapse Deployment Selection Details'
            : 'Expand Deployment Selection Details'
        "
        :dropdown-codicon="
          home.easyDeployExpanded
            ? 'codicon codicon-chevron-down'
            : 'codicon codicon-chevron-right'
        "
        @click="onClickDeploy"
        @dropdown-click="onClickDeployExpand"
      >
        Deploy Your Project
      </ButtonDropdown>
    </div>
    <div v-if="home.easyDeployExpanded">
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
          class="dropdowns"
        />
      </div>
      <label for="credentials-selector">Credentials:</label>
      <PSelect
        v-model="home.selectedCredential"
        :options="home.filteredCredentials"
        :get-key="(a: Account) => a.name"
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

import ButtonDropdown from "./ButtonDropdown.vue";
import PSelect from "./PSelect.vue";
import { useHostConduitService } from "../HostConduitService";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

const home = useHomeStore();
const hostConduit = useHostConduitService();

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

const disableDeployment = computed(() => {
  const result =
    !Boolean(home.selectedDeployment) ||
    !Boolean(home.selectedConfiguration) ||
    !Boolean(home.selectedCredential);
  return result;
});

const onClickDeployExpand = () => {
  home.easyDeployExpanded = !home.easyDeployExpanded;
};

const onClickDeploy = () => {
  if (
    !home.selectedDeployment ||
    !home.selectedConfiguration ||
    !home.selectedCredential
  ) {
    throw new Error(
      "EasyDeploy::onClickDeploy trying to send message with undefined values",
    );
  }
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.DEPLOY,
    content: {
      deploymentName: home.selectedDeployment.saveName,
      configurationName: home.selectedConfiguration.configurationName,
      credentialName: home.selectedCredential.name,
    },
  });
};

const navigateToUrl = (url: string) => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NAVIGATE,
    content: {
      uriPath: url,
    },
  });
};

const onClickAddDeployment = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_DEPLOYMENT,
  });
};

const onClickAddConfiguration = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_CONFIGURATION,
  });
};

const onClickEditConfiguration = () => {
  if (!home.selectedConfiguration?.configurationName) {
    throw new Error(
      "EasyDeploy::onClickEditConfiguration trying to send message with undefined values",
    );
  }
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
    content: {
      configurationName: home.selectedConfiguration?.configurationName,
    },
  });
};

const onUpdateModelValueSelectedDeployment = () => {
  updateCredentialsAndConfigurationForDeployment();
  home.updateParentViewSelectionState();
};

const updateCredentialsAndConfigurationForDeployment = () => {
  home.filterCredentialsToDeployment();
  if (home.selectedDeployment?.configurationName) {
    home.updateSelectedConfigurationByName(
      home.selectedDeployment.configurationName,
    );
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

:deep(.deploy-button) {
  flex: 1;
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
