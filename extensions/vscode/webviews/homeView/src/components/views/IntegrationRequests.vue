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
        OAuth Integrations are not supported with your current server
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
      :actions="[
        {
          label: 'Delete Integration Request',
          codicon: 'codicon-trash',
          fn: () =>
            sendMsg({
              kind: WebviewToHostMessageType.DELETE_INTEGRATION_REQUEST,
              content: {
                request: integrationRequest,
              },
            }),
        },
      ]"
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
import { send } from "vite";

const { sendMsg } = useHostConduitService();
const home = useHomeStore();

const isOAuthIntegrationsSupported = computed(() => {
  const validLicense =
    home.serverSettings?.license?.["oauth-integrations"] ?? false;
  const oauthIntegrationsEnabled =
    home.serverSettings?.oauth_integrations_enabled ?? false;
  return validLicense && oauthIntegrationsEnabled;
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
      label: "Clear all Integration Request Values",
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
</script>
