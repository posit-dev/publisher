<template>
  <TreeSection title="Credentials" :actions="sectionActions">
    <WelcomeView v-if="home.sortedCredentials.length === 0">
      <p>No credentials have been added yet.</p>
    </WelcomeView>
    <TreeItem
      v-else
      v-for="credential in home.sortedCredentials"
      :title="credential.name"
      :description="credential.url"
      :codicon="
        credential.guid === CredentialGUIs.EnvironmentGUID
          ? 'codicon-bracket'
          : 'codicon-key'
      "
      align-icon-with-twisty
      :data-vscode-context="
        credential.guid === CredentialGUIs.EnvironmentGUID
          ? undefined
          : `{&quot;webviewSection&quot;: &quot;credentials-tree-item&quot;, &quot;credentialGUID&quot;: &quot;${credential.guid}&quot;, &quot;credentialName&quot;: &quot;${credential.name}&quot;, &quot;preventDefaultContextMenuItems&quot;: true}`
      "
    />
  </TreeSection>
</template>

<script setup lang="ts">
import { computed } from "vue";

import TreeSection from "src/components/TreeSection.vue";
import TreeItem from "src/components/TreeItem.vue";
import WelcomeView from "src/components/WelcomeView.vue";
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
