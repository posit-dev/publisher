<template>
  <TreeSection title="Credentials" :actions="sectionActions">
    <TreeItem
      v-for="credential in home.sortedCredentials"
      :title="credential.name"
      :description="credential.url"
      :codicon="
        credential.guid === CredentialGUIs.EnvironmentGUID
          ? 'codicon-bracket'
          : 'codicon-key'
      "
      align-icon-with-twisty
    />
  </TreeSection>
</template>

<script setup lang="ts">
import { computed } from "vue";

import TreeSection from "src/components/tree/TreeSection.vue";
import TreeItem from "src/components/tree/TreeItem.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

import { CredentialGUIs } from "../../../../../src/constants";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";

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
</script>
