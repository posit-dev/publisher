<template>
  <TreeSection
    title="Integration Requests"
    data-automation="publisher-integrationRequests-section"
    :actions="sectionActions"
  >
    <WelcomeView
      v-if="home.serverSettings !== undefined && !isOAuthIntegrationsSupported"
    >
      <p>
        OAuth Integrations are not supported with your current server version,
        configuration or license. Please contact your server administrator for
        more information.
      </p>
    </WelcomeView>
    <WelcomeView v-else-if="!home.integrationRequests.length">
      <p>No integration requests have been added yet.</p>
    </WelcomeView>
    <TreeItem
      v-else
      v-for="integrationRequest in home.integrationRequests"
      :title="integrationRequest.displayName ?? ''"
      :description="integrationRequest.displayDescription ?? ''"
      :data-automation="`integration-request-${integrationRequest.name || ''}-list`"
      codicon="posit-publisher-icons-posit-logo"
      :actions="getIntegrationRequestActions(integrationRequest)"
      align-icon-with-twisty
    />
  </TreeSection>
</template>

<script setup lang="ts">
import { computed } from "vue";

import TreeSection from "src/components/tree/TreeSection.vue";
import TreeItem from "src/components/tree/TreeItem.vue";
import WelcomeView from "src/components/WelcomeView.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { IntegrationRequest } from "../../../../../src/api";

const { sendMsg } = useHostConduitService();
const home = useHomeStore();

const isOAuthIntegrationsSupported = computed(() => {
  if (!home.serverSettings) {
    return false;
  }
  // if settings has version set, then parse it, otherwise ignore that value
  const serverVersion = home.serverSettings?.version ?? "0.0.0";
  const [major, minor] = serverVersion.split(".").map((v) => parseInt(v, 10));

  // OAuth Integrations are supported starting in version 2025.09
  const validVersion = major > 2025 && minor > 9;
  const validLicense =
    home.serverSettings?.license?.["oauth-integrations"] ?? false;
  const oauthIntegrationsEnabled =
    home.serverSettings?.oauth_integrations_enabled ?? false;
  return validVersion && validLicense && oauthIntegrationsEnabled;
});

const sectionActions = computed(() => {
  if (!isOAuthIntegrationsSupported.value) {
    return [];
  }
  const result = [
    {
      label: "Add Integration Request",
      codicon: "codicon-add",
      fn: () => {
        sendMsg({
          kind: WebviewToHostMessageType.ADD_INTEGRATION_REQUEST,
        });
      },
    },
  ];

  if (home.integrationRequests.length > 0) {
    result.push({
      label: "Clear all Integration Requests",
      codicon: "codicon-clear-all",
      fn: () => {
        sendMsg({
          kind: WebviewToHostMessageType.CLEAR_ALL_INTEGRATION_REQUESTS,
        });
      },
    });
  }
  return result;
});

const getIntegrationRequestActions = (
  integrationRequest: IntegrationRequest,
) => [
  {
    label: "Delete Integration Request",
    codicon: "codicon-trash",
    fn: () =>
      sendMsg({
        kind: WebviewToHostMessageType.DELETE_INTEGRATION_REQUEST,
        content: {
          request: integrationRequest,
        },
      }),
  },
];
</script>
