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
          :label="destinationTitle"
          :detail="destinationSubTitle"
          :title="toolTipText"
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

      <div
        v-if="home.selectedConfiguration?.configuration?.entrypoint"
        class="destination-details-container"
      >
        <div class="destination-details-row">
          <span class="destination-details-label">{{
            home.selectedConfiguration.configuration.entrypoint
          }}</span>
          <span class="destination-details-info">
            (selected as entrypoint)</span
          >
        </div>
      </div>

      <p v-if="isConfigEntryMissing">
        No Config Entry in Deployment file -
        {{ home.selectedDeployment?.saveName }}.
        <a href="" role="button" @click="selectConfiguration"
          >Select a Configuration</a
        >.
      </p>
      <p v-if="isConfigMissing">
        The last Configuration used for this Destination was not found.
        <a href="" role="button" @click="selectConfiguration"
          >Select a Configuration</a
        >.
      </p>
      <p v-if="isConfigInError">
        The selected Configuration has an error.
        <a
          href=""
          role="button"
          @click="
            onEditConfiguration(home.selectedDeployment!.configurationName)
          "
          >Edit the Configuration</a
        >.
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

      <div v-if="home.publishInProgress">
        <div class="deployment-in-progress-container">
          <div class="progress-container">
            <vscode-progress-ring class="progress-ring" />
            Deployment in Progress...
          </div>
          <ActionToolbar
            title="Logs"
            :actions="[]"
            context-menu="homeview-active-deployment-more-menu"
          />
        </div>
      </div>
      <div v-else>
        <div class="deployment-summary-container">
          <h4 class="deployment-summary">
            {{ lastStatusDescription }}
          </h4>
          <ActionToolbar
            title="Logs"
            :actions="[]"
            context-menu="homeview-last-deployment-more-menu"
          />
        </div>
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

import { isConfigurationError, isPreDeployment } from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { calculateTitle } from "../../../../src/utils/titles";

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
        onEditConfiguration(home.selectedConfiguration!.configurationName),
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

const onEditConfiguration = (name: string) => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
    content: {
      configurationName: name,
    },
  });
};

const isConfigInErrorList = (configName?: string): boolean => {
  if (!configName) {
    return false;
  }
  return Boolean(
    home.configurationsInError.find(
      (config) =>
        config.configurationName === home.selectedDeployment?.configurationName,
    ),
  );
};

const isConfigEntryMissing = computed((): boolean => {
  return Boolean(
    home.selectedDeployment && !home.selectedDeployment.configurationName,
  );
});

const isConfigMissing = computed((): boolean => {
  return Boolean(
    home.selectedDeployment &&
      !home.selectedConfiguration &&
      !isConfigInErrorList(home.selectedDeployment?.configurationName) &&
      !isConfigEntryMissing.value,
  );
});

const isConfigInError = computed((): boolean => {
  return Boolean(
    home.selectedDeployment &&
      !home.selectedConfiguration &&
      isConfigInErrorList(home.selectedDeployment?.configurationName),
  );
});

const destinationTitle = computed(() => {
  if (!home.selectedDeployment) {
    // no title if there is no selected deployment
    return "";
  }

  const result = calculateTitle(
    home.selectedDeployment,
    home.selectedConfiguration,
  );
  return result.title;
});

const destinationSubTitle = computed(() => {
  if (home.serverCredential?.name) {
    return `${home.serverCredential.name}`;
  }
  return `Missing Credential for ${home.selectedDeployment?.serverUrl}`;
});

const isCredentialMissing = computed((): boolean => {
  return Boolean(home.selectedDeployment && !home.serverCredential);
});

const selectConfiguration = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SELECT_CONFIGURATION,
  });
};

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

const toolTipText = computed(() => {
  return `Destination Details
- Deployment File: ${home.selectedDeployment?.saveName || "<undefined>"}
- Configuration File: ${home.selectedConfiguration?.configurationName || "<undefined>"}
- Credential In Use: ${home.serverCredential?.name || "<undefined>"}
- Server URL: ${home.serverCredential?.url || "<undefined>"}`;
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

.deployment-in-progress-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deployment-summary-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-items: baseline;
}

.destination-control {
  display: flex;
  align-items: center;

  cursor: pointer;
  margin: 0.5rem 0;
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
  min-width: 0;
  word-wrap: break-word;
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

.destination-details-container {
  margin-bottom: 0.5rem;

  .destination-details-row {
    display: flex;
    align-items: center;

    .destination-details-label {
      font-size: 0.9em;
      line-height: normal;
      opacity: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre;
    }

    .destination-details-info {
      font-size: 0.8em;
      line-height: normal;
      opacity: 0.7;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre;
    }
  }
}
</style>
