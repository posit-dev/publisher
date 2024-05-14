<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div class="label">
      <span>Destination:</span>

      <ActionToolbar
        title="Destination"
        :actions="toolbarActions"
        :context-menu="
          home.selectedDeployment ? 'even-easier-deploy-more-menu' : undefined
        "
      />
    </div>

    <template v-if="home.deployments.length > 0">
      <div
        class="destination-control"
        :disabled="home.deployments.length === 0 ? true : undefined"
        v-on="home.deployments.length ? { click: onSelectDestination } : {}"
      >
        <QuickPickItem
          v-if="home.selectedDeployment"
          :label="home.selectedDeployment.saveName"
          :description="
            isConfigMissing
              ? `Missing Configuration ${home.selectedDeployment.configurationName}`
              : home.selectedDeployment.configurationName
          "
          :detail="
            home.serverCredential?.name ||
            `Missing Credential for ${home.selectedDeployment.serverUrl}`
          "
        />

        <QuickPickItem
          v-else
          class="text-placeholder"
          label="Select a Destination"
          detail="Get deploying"
        />

        <div
          class="select-indicator codicon codicon-chevron-down"
          aria-hidden="true"
        />
      </div>

      <p v-if="isConfigMissing">
        The last Configuration used for this Destination was not found. Choose a
        new Configuration.
      </p>

      <p v-if="isCredentialMissing">
        A Credential for the Destination's server URL was not found.
        <a href="" role="button" @click="newCredential"
          >Create a new Credential</a
        >.
      </p>

      <DeployButton class="w-full" />
    </template>
    <vscode-button
      v-else
      class="w-full add-destination-btn"
      @click="onAddDestination"
    >
      Add Destination
    </vscode-button>

    <template
      v-if="home.selectedDeployment && home.selectedDeployment.serverType"
    >
      <vscode-divider class="home-view-divider" />

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
            class="w-full"
          >
            View Content
          </vscode-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isPreDeployment } from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";
import QuickPickItem from "src/components/QuickPickItem.vue";
import ActionToolbar from "src/components/ActionToolbar.vue";
import DeployButton from "src/components/DeployButton.vue";
import { formatDateString } from "src/utils/date";

const home = useHomeStore();
const hostConduit = useHostConduitService();

const toolbarActions = computed(() => {
  const result = [];
  result.push({
    label: "Add Destination",
    codicon: "codicon-add",
    fn: onAddDestination,
  });

  if (home.selectedConfiguration) {
    result.push({
      label: "Edit Configuration",
      codicon: "codicon-edit",
      fn: () =>
        hostConduit.sendMsg({
          kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
          content: {
            configurationName: home.selectedConfiguration!.configurationName,
          },
        }),
    });
  }
  return result;
});

const onSelectDestination = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SELECT_DESTINATION,
  });
};

const onAddDestination = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_DESTINATION,
  });
};

const isConfigMissing = computed((): boolean => {
  return Boolean(home.selectedDeployment && !home.selectedConfiguration);
});

const isCredentialMissing = computed((): boolean => {
  return Boolean(home.selectedDeployment && !home.serverCredential);
});

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

const navigateToUrl = (url: string) => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NAVIGATE,
    content: {
      uriPath: url,
    },
  });
};

const newCredential = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_CREDENTIAL,
  });
};
</script>

<style lang="scss" scoped>
.label {
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
}

.destination-control {
  display: flex;
  align-items: center;

  cursor: pointer;
  margin: 0.5rem 0 1rem;
  padding: 2px 6px 6px 8px;
  background: var(--dropdown-background);
  border: calc(var(--border-width) * 1px) solid var(--dropdown-border);
  border-radius: calc(var(--corner-radius-round) * 1px);
  position: relative;
  user-select: none;
  outline: none;

  &[open],
  &:active:not([disabled]) {
    border-color: var(--focus-border);
  }

  &[disabled] {
    cursor: not-allowed;
    opacity: var(--disabled-opacity);
  }

  .select-indicator {
    flex: none;
    margin-inline-start: 1em;
  }
}

:deep(.action-item) {
  margin-right: 4px;
}

.add-destination-btn {
  margin: 0.5rem 0 1rem;
}

.home-view-divider {
  margin-top: 1.33em;
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
  align-items: center;
}

.error-icon {
  flex: 0;
}

.error-message {
  margin-left: 5px;
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
</style>
