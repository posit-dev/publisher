<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div v-if="home.initializingRequestComplete">
    <div class="label">
      <span class="text-sm text-sidebar-section-header">DEPLOYMENT</span>

      <ActionToolbar
        title="Deployment"
        :actions="toolbarActions"
        :context-menu="
          home.selectedContentRecord ? contextMenuContext : undefined
        "
      />
    </div>

    <template v-if="home.selectedContentRecord">
      <div class="deployment-control" v-on="{ click: onSelectDeployment }">
        <QuickPickItem
          :label="deploymentTitle"
          :details="deploymentSubTitles"
          :title="toolTipText"
          :data-automation="`entrypoint-label`"
        />
        <div
          class="select-indicator codicon codicon-chevron-right"
          aria-hidden="true"
        />
      </div>

      <template v-if="home.duplicatedEnvironmentVariables.length">
        <p>
          <template v-if="home.duplicatedEnvironmentVariables.length === 1">
            A variable was set as both a secret and environment variable. It
            must only be set as one or the other.
          </template>
          <template v-if="home.duplicatedEnvironmentVariables.length > 1">
            Variables were set as both secrets and environment variables. They
            must only be set as one or the other.
          </template>
          <a
            class="webview-link"
            role="button"
            @click="
              onEditConfiguration(home.selectedConfiguration!.configurationPath)
            "
            >Edit the Configuration</a
          >.
        </p>
        <p>{{ home.duplicatedEnvironmentVariables.join(", ") }}</p>
        <p></p>
      </template>

      <p v-if="home.config.active.isEntryMissing">
        No Config Entry in Deployment record -
        {{ home.selectedContentRecord?.saveName }}.
        <a class="webview-link" role="button" @click="selectConfiguration">{{
          promptForConfigSelection
        }}</a
        >.
      </p>
      <p v-if="home.config.active.isMissing" data-automation="missing-config">
        The last Configuration used for this Deployment was not found.
        <a
          class="webview-link"
          role="button"
          @click="selectConfiguration"
          data-automation="config-button"
          >{{ promptForConfigSelection }}</a
        >.
      </p>
      <p v-if="home.config.active.isTOMLError" data-automation="edit-config">
        The selected Configuration has a schema error
        {{ getActiveConfigTOMLErrorDetails }}.
        <a
          class="webview-link"
          role="button"
          @click="onEditConfigurationWithTOMLError()"
          data-automation="edit-config-button"
          >Edit the Configuration</a
        >.
      </p>
      <p v-if="home.config.active.isUnknownError">
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

      <p
        v-if="home.config.active.isCredentialMissing"
        data-automation="missing-creds"
      >
        A Credential for the Deployment's server URL was not found.
        <a
          class="webview-link"
          role="button"
          @click="newCredential"
          data-automation="creds-button"
          >Create a new Credential</a
        >.
      </p>

      <DeployButton class="w-full" />
    </template>
    <div v-else class="deployment-control" v-on="{ click: onSelectDeployment }">
      <QuickPickItem
        label="Select..."
        :details="['(new or existing)']"
        data-automation="select-deployment"
      />
      <div
        class="select-indicator codicon codicon-chevron-down"
        aria-hidden="true"
      />
    </div>
    <template
      v-if="home.selectedContentRecord && home.selectedContentRecord.serverType"
    >
      <vscode-divider class="home-view-divider" />

      <div v-if="home.publishInProgress">
        <div class="deployment-in-progress-container">
          <div class="progress-container">
            <vscode-progress-ring class="progress-ring" />
            <div class="progress-desc">
              <div data-automation="deployment-progress">
                Deployment in Progress...
              </div>
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
        <div
          class="deployment-summary-container"
          data-automation="deploy-status"
        >
          <h4 class="deployment-summary">
            {{ lastStatusDescription }}
          </h4>
          <ActionToolbar
            title="Logs"
            :actions="[]"
            :context-menu="contextMenuVSCodeContext"
          />
        </div>
        <div v-if="isPreContentRecordWithoutID">
          Is this already deployed to a Connect server? You can
          <a class="webview-link" role="button" @click="onAssociateDeployment"
            >update that previous deployment</a
          >.
        </div>
        <div v-if="isPreContentRecordWithID">
          <a class="webview-link" role="button" @click="viewContent"
            >This deployment</a
          >
          will be updated when deployed.
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
          <div class="alert-border border-warning text-warning">
            <span class="codicon codicon-alert" />
          </div>
          <TextStringWithAnchor
            :message="home.selectedContentRecord?.deploymentError?.msg"
            :splitOptions="ErrorMessageSplitOptions"
            class="error-message"
            @click="onErrorMessageAnchorClick"
          />
        </div>
        <div
          v-if="!isPreContentRecord(home.selectedContentRecord)"
          class="last-deployment-details"
        >
          <vscode-button
            appearance="secondary"
            @click="viewContent"
            class="w-full"
          >
            {{ deployedContentButtonLabel }}
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
import { computed } from "vue";
import {
  Configuration,
  isPreContentRecord,
  isConfigurationError,
} from "../../../../src/api";
import {
  ErrorMessageActionIds,
  ErrorMessageSplitOptions,
} from "../../../../src/utils/errorEnhancer";
import {
  EditConfigurationSelection,
  WebviewToHostMessageType,
} from "../../../../src/types/messages/webviewToHostMessages";
import { calculateTitle } from "../../../../src/utils/titles";
import { formatDateString } from "src/utils/date";
import { filterConfigurationsToValidAndType } from "../../../../src/utils/filters";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";

import QuickPickItem from "src/components/QuickPickItem.vue";
import ActionToolbar from "src/components/ActionToolbar.vue";
import DeployButton from "src/components/DeployButton.vue";
import TextStringWithAnchor from "./TextStringWithAnchor.vue";
import {
  AgentError,
  isAgentErrorInvalidTOML,
  isAgentErrorDeployedContentNotRunning,
} from "../../../../src/api/types/error";

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

const onEditConfiguration = (
  fullPath: string,
  selection?: EditConfigurationSelection,
) => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
    content: {
      configurationPath: fullPath,
      selection,
    },
  });
};

const onViewPublishingLog = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.VIEW_PUBLISHING_LOG,
  });
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

const deploymentSubTitles = computed(() => {
  const subTitles: string[] = [];
  subTitles.push(credentialSubTitle.value);
  if (entrypointSubTitle.value) {
    subTitles.push(entrypointSubTitle.value);
  }
  return subTitles;
});

const credentialSubTitle = computed(() => {
  if (home.serverCredential?.name) {
    return `${home.serverCredential.name}`;
  }
  return `Missing Credential for ${home.selectedContentRecord?.serverUrl}`;
});

const entrypointSubTitle = computed(() => {
  if (
    home.selectedConfiguration &&
    !isConfigurationError(home.selectedConfiguration)
  ) {
    const contentRecord = home.selectedContentRecord;
    const config = home.selectedConfiguration;
    if (contentRecord) {
      let subTitle = "";
      if (contentRecord.projectDir !== ".") {
        subTitle = `${contentRecord.projectDir}${home.platformFileSeparator}`;
      }
      if (!home.config.active.isUnknownError) {
        subTitle += config.configuration.entrypoint;
      }
      return subTitle;
    }
  }
  return "ProjectDir and Entrypoint not determined";
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
    return isPreContentRecordWithID.value
      ? "Not Yet Updated"
      : "Not Yet Deployed";
  }
  return "Last Deployment Successful";
});

const isPreContentRecordWithID = computed(() => {
  return (
    isPreContentRecord(home.selectedContentRecord) &&
    Boolean(home.selectedContentRecord.id)
  );
});

const isPreContentRecordWithoutID = computed(() => {
  return (
    isPreContentRecord(home.selectedContentRecord) &&
    !isPreContentRecordWithID.value
  );
});

const toolTipText = computed(() => {
  let entrypoint = "unknown";
  if (
    home.selectedConfiguration &&
    !isConfigurationError(home.selectedConfiguration) &&
    home.selectedConfiguration.configuration.entrypoint
  ) {
    entrypoint = home.selectedConfiguration.configuration.entrypoint;
  }
  return `Deployment Details
- Deployment Record: ${home.selectedContentRecord?.saveName || "<undefined>"}
- Configuration File: ${home.selectedConfiguration?.configurationName || "<undefined>"}
- Credential In Use: ${home.serverCredential?.name || "<undefined>"}
- Project Dir: ${home.selectedContentRecord?.projectDir || "<undefined>"}
- Entrypoint: ${entrypoint}
- Server URL: ${home.serverCredential?.url || "<undefined>"}`;
});

const getActiveConfigError = computed((): AgentError | undefined => {
  if (
    home.selectedConfiguration &&
    isConfigurationError(home.selectedConfiguration) &&
    isAgentErrorInvalidTOML(home.selectedConfiguration.error)
  ) {
    return home.selectedConfiguration.error;
  }
  return undefined;
});

const getActiveConfigTOMLErrorDetails = computed(() => {
  const agentError = getActiveConfigError.value;
  if (agentError && isAgentErrorInvalidTOML(agentError)) {
    return `on line ${agentError.data.line}`;
  }
  return "";
});

const isDeployedContentOnError = computed((): boolean => {
  const deploymentError = home.selectedContentRecord?.deploymentError;
  return Boolean(
    deploymentError && isAgentErrorDeployedContentNotRunning(deploymentError),
  );
});

const deployedContentButtonLabel = computed((): string => {
  if (isDeployedContentOnError.value) {
    return "View Deployment Logs";
  }
  return "View Content";
});

const onEditConfigurationWithTOMLError = () => {
  const agentError = getActiveConfigError.value;
  if (agentError && isAgentErrorInvalidTOML(agentError)) {
    onEditConfiguration(home.selectedConfiguration!.configurationPath, {
      start: {
        line: agentError.data.line - 1,
        character: agentError.data.column - 1,
      },
    });
  }
  console.error(
    "EvenEasierDeploy::onEditConfigurationWithTOMLError, error is not expected type. Ignoring.",
  );
  return;
};

const onErrorMessageAnchorClick = (splitOptionId: number) => {
  const option = ErrorMessageSplitOptions.find(
    (option) => option.actionId === splitOptionId,
  );
  if (!option) {
    console.error(
      "EvenEasierDeploy::onErrorMessageAnchorClick, event does not match options. Ignoring.",
    );
    return;
  }
  if (option.actionId === ErrorMessageActionIds.EditConfiguration) {
    onEditConfiguration(home.selectedConfiguration!.configurationPath);
    return;
  }
};

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
    kind: WebviewToHostMessageType.NEW_CREDENTIAL_FOR_DEPLOYMENT,
  });
};

const onAssociateDeployment = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SHOW_ASSOCIATE_GUID,
  });
};

const viewContent = () => {
  const record = home.selectedContentRecord;
  if (!record) {
    return;
  }
  if (isDeployedContentOnError.value && !isPreContentRecord(record)) {
    navigateToUrl(record.logsUrl);
  } else if (record.dashboardUrl) {
    navigateToUrl(record.dashboardUrl);
  }
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
  display: flex;
  align-items: stretch;

  .alert-border {
    display: flex;
    align-items: center;
    border-right-width: 1px;
    border-right-style: solid;
    padding-right: 5px;
    margin-right: 7px;
  }
}

.error-icon {
  flex: 0;
}

.error-message {
  min-width: 0;
  word-wrap: break-word;
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
</style>
