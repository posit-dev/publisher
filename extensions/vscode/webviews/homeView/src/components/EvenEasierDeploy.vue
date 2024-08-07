<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div v-if="home.initializingRequestComplete">
    <div class="label">
      <span>Deployment:</span>

      <ActionToolbar
        title="Deployment"
        :actions="toolbarActions"
        :context-menu="
          home.selectedContentRecord ? contextMenuContext : undefined
        "
      />
    </div>

    <template v-if="home.contentRecords.length > 0">
      <div
        class="deployment-control"
        :disabled="home.contentRecords.length === 0 ? true : undefined"
        v-on="home.contentRecords.length ? { click: onSelectDeployment } : {}"
      >
        <QuickPickItem
          v-if="home.selectedContentRecord"
          :label="deploymentTitle"
          :detail="deploymentSubTitle"
          :title="toolTipText"
        />

        <QuickPickItem
          v-else
          class="text-placeholder"
          label="Select a Deployment"
          detail="Get deploying"
        />

        <div
          class="select-indicator codicon codicon-chevron-down"
          aria-hidden="true"
        />
      </div>

      <div
        v-if="
          home.selectedConfiguration &&
          !isConfigurationError(home.selectedConfiguration) &&
          home.selectedConfiguration?.configuration?.entrypoint
        "
        class="deployment-details-container"
      >
        <div class="deployment-details-row">
          <span class="deployment-details-label">{{
            home.selectedConfiguration.configuration.entrypoint
          }}</span>
          <span class="deployment-details-info"> (selected as entrypoint)</span>
        </div>
      </div>

      <p v-if="isConfigEntryMissing">
        No Config Entry in Deployment record -
        {{ home.selectedContentRecord?.saveName }}.
        <a class="webview-link" role="button" @click="selectConfiguration">{{
          promptForConfigSelection
        }}</a
        >.
      </p>
      <p v-if="isConfigMissing">
        The last Configuration used for this Deployment was not found.
        <a class="webview-link" role="button" @click="selectConfiguration">{{
          promptForConfigSelection
        }}</a
        >.
      </p>
      <p v-if="isConfigInError">
        The selected Configuration has an error.
        <a
          class="webview-link"
          role="button"
          @click="
            onEditConfiguration(home.selectedConfiguration!.configurationPath)
          "
          >Edit the Configuration</a
        >.
      </p>

      <p v-if="isCredentialMissing">
        A Credential for the Deployment's server URL was not found.
        <a class="webview-link" role="button" @click="newCredential"
          >Create a new Credential</a
        >.
      </p>

      <DeployButton class="w-full" />
    </template>
    <vscode-button
      v-else
      class="w-full add-deployment-btn"
      @click="onAddDeployment"
      data-automation="add-deployment-button"
    >
      Add Deployment
    </vscode-button>

    <template
      v-if="home.selectedContentRecord && home.selectedContentRecord.serverType"
    >
      <vscode-divider class="home-view-divider" />

      <div v-if="home.publishInProgress">
        <div class="deployment-in-progress-container">
          <div class="progress-container">
            <vscode-progress-ring class="progress-ring" />
            <div class="progress-desc">
              <div>Deployment in Progress...</div>
              <p class="progress-log-anchor">
                <a
                  class="webview-link"
                  role="button"
                  @click="onViewPublishingLog"
                  >View Log</a
                >
              </p>
            </div>
          </div>
          <ActionToolbar
            title="Logs"
            :actions="[]"
            :context-menu="contextMenuVSCodeContext"
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
            :context-menu="contextMenuVSCodeContext"
          />
        </div>
        <div
          v-if="!isPreContentRecord(home.selectedContentRecord)"
          class="last-deployment-time"
        >
          {{ formatDateString(home.selectedContentRecord.deployedAt) }}
        </div>
        <div
          v-if="home.selectedContentRecord.deploymentError"
          class="last-deployment-details last-deployment-error"
        >
          <span class="codicon codicon-error error-icon"></span>
          <span class="error-message">
            Error: {{ home.selectedContentRecord.deploymentError.msg }}
          </span>
        </div>
        <div
          v-if="!isPreContentRecord(home.selectedContentRecord)"
          class="last-deployment-details"
        >
          <vscode-button
            appearance="secondary"
            @click="navigateToUrl(home.selectedContentRecord.dashboardUrl)"
            class="w-full"
          >
            View Content
          </vscode-button>
        </div>
      </div>
    </template>
  </div>
  <div v-else>
    <div class="progress-container">
      <div class="progress-desc">
        <div>Scanning directories...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import {
  Configuration,
  isPreContentRecord,
  isConfigurationError,
} from "../../../../src/api";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { calculateTitle } from "../../../../src/utils/titles";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";
import QuickPickItem from "src/components/QuickPickItem.vue";
import ActionToolbar from "src/components/ActionToolbar.vue";
import DeployButton from "src/components/DeployButton.vue";
import { formatDateString } from "src/utils/date";
import { filterConfigurationsToValidAndType } from "../../../../src/utils/filters";

const home = useHomeStore();
const hostConduit = useHostConduitService();

const toolbarActions = computed(() => {
  const result = [];
  result.push({
    label: "Add Deployment",
    codicon: "codicon-add",
    fn: onAddDeployment,
  });

  if (home.selectedConfiguration) {
    result.push({
      label: "Edit Configuration",
      codicon: "codicon-edit",
      fn: () =>
        onEditConfiguration(home.selectedConfiguration!.configurationPath),
    });
  }
  return result;
});

const onSelectDeployment = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SELECT_DEPLOYMENT,
  });
};

const onAddDeployment = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_DEPLOYMENT,
  });
};

const onEditConfiguration = (fullPath: string) => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
    content: {
      configurationPath: fullPath,
    },
  });
};

const onViewPublishingLog = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.VIEW_PUBLISHING_LOG,
  });
};

const isConfigInErrorList = (configName?: string): boolean => {
  if (!configName) {
    return false;
  }
  return Boolean(
    home.configurationsInError.find(
      (config) =>
        config.configurationName ===
        home.selectedContentRecord?.configurationName,
    ),
  );
};

const filteredConfigs = computed((): Configuration[] => {
  return filterConfigurationsToValidAndType(
    home.configurations,
    home.selectedContentRecord?.type,
  );
});

const contextMenuContext = computed((): string => {
  return filteredConfigs.value.length > 0
    ? "even-easier-deploy-more-menu-matching-configs"
    : "even-easier-deploy-more-menu-no-matching-configs";
});

const promptForConfigSelection = computed((): string => {
  return filteredConfigs.value.length > 0
    ? "Select a Configuration"
    : "Create a Configuration";
});

const contextMenuVSCodeContext = computed((): string => {
  return home.publishInProgress ||
    isPreContentRecord(home.selectedContentRecord)
    ? "homeview-active-contentRecord-more-menu"
    : "homeview-last-contentRecord-more-menu";
});

const isConfigEntryMissing = computed((): boolean => {
  return Boolean(
    home.selectedContentRecord && !home.selectedContentRecord.configurationName,
  );
});

const isConfigMissing = computed((): boolean => {
  return Boolean(
    home.selectedContentRecord &&
      !home.selectedConfiguration &&
      !isConfigInErrorList(home.selectedContentRecord?.configurationName) &&
      !isConfigEntryMissing.value,
  );
});

const isConfigInError = computed((): boolean => {
  return Boolean(
    home.selectedConfiguration &&
      isConfigurationError(home.selectedConfiguration),
  );
});

const deploymentTitle = computed(() => {
  if (!home.selectedContentRecord) {
    // no title if there is no selected contentRecord
    return "";
  }

  const result = calculateTitle(
    home.selectedContentRecord,
    home.selectedConfiguration,
  );
  return result.title;
});

const deploymentSubTitle = computed(() => {
  if (home.serverCredential?.name) {
    return `${home.serverCredential.name}`;
  }
  return `Missing Credential for ${home.selectedContentRecord?.serverUrl}`;
});

const isCredentialMissing = computed((): boolean => {
  return Boolean(home.selectedContentRecord && !home.serverCredential);
});

const selectConfiguration = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SHOW_SELECT_CONFIGURATION,
  });
};

const lastStatusDescription = computed(() => {
  if (!home.selectedContentRecord) {
    return undefined;
  }
  if (home.selectedContentRecord.deploymentError) {
    return "Last Deployment Failed";
  }
  if (isPreContentRecord(home.selectedContentRecord)) {
    return "Not Yet Deployed";
  }
  return "Last Deployment Successful";
});

const toolTipText = computed(() => {
  return `Deployment Details
- Deployment Record: ${home.selectedContentRecord?.saveName || "<undefined>"}
- Configuration File: ${home.selectedConfiguration?.configurationName || "<undefined>"}
- Credential In Use: ${home.serverCredential?.name || "<undefined>"}
- Project Dir: ${home.selectedContentRecord?.projectDir || "<undefined>"}
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

.deployment-control {
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

.add-deployment-btn {
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

.progress-desc {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.progress-log-anchor {
  margin-top: 5px;
  margin-bottom: 0px;
}

.deployment-details-container {
  margin-bottom: 0.5rem;

  .deployment-details-row {
    display: flex;
    align-items: center;

    .deployment-details-label {
      font-size: 0.9em;
      line-height: normal;
      opacity: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre;
    }

    .deployment-details-info {
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
