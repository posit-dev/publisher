<template>
  <TreeSection
    title="Credentials"
    data-automation="publisher-credentials-section"
    :actions="sectionActions"
    :codicon="home.credential.active.isAlertActive ? `codicon-alert` : ``"
  >
    <WelcomeView v-if="!home.credential.isAvailable">
      <p>No credentials have been added yet.</p>
    </WelcomeView>
    <TreeItem
      v-else
      v-for="credential in home.sortedCredentials"
      :title="credential.name"
      :description="getDescription(credential)"
      :data-automation="`${credential.name}-list`"
      codicon="posit-publisher-icons-posit-logo"
      align-icon-with-twisty
      :data-vscode-context="vscodeContext(credential)"
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

import { Credential, ProductName } from "../../../../../src/api";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { isConnectCloud } from "../../../../../src/utils/multiStepHelpers";

const home = useHomeStore();

const { sendMsg } = useHostConduitService();

const sectionActions = computed(() => {
  return [
    {
      label: "New Credential",
      codicon: "codicon-add",
      fn: () => {
        sendMsg({
          kind: WebviewToHostMessageType.NEW_CREDENTIAL,
        });
      },
    },
    {
      label: "Refresh Credentials",
      codicon: "codicon-refresh",
      fn: () => {
        sendMsg({ kind: WebviewToHostMessageType.REQUEST_CREDENTIALS });
      },
    },
  ];
});

const getDescription = (credential: Credential) => {
  return isConnectCloud(credential.serverType)
    ? ProductName.CONNECT_CLOUD
    : credential.url;
};

const vscodeContext = (credential: Credential) => {
  return JSON.stringify({
    credentialGUID: credential.guid,
    credentialName: credential.name,
    webviewSection: "credentials-tree-item",
    preventDefaultContextMenuItems: true,
  });
};
</script>
