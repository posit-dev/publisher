<template>
  <TreeSection
    title="Credentials"
    data-automation="credentials"
    :header-actions="credentialsHeaderActions"
    :actions="sectionActions"
    :expanded="sectionExpanded"
  >
    <WelcomeView v-if="showWelcomeView">
      <template v-if="home.credentialsAlert">
        <p>No credentials have been added yet.</p>
      </template>
    </WelcomeView>
    <TreeItem
      v-else
      v-for="credential in home.sortedCredentials"
      :title="credential.name"
      :description="credential.url"
      :data-automation="`${credential.name}-list`"
      :codicon="
        credential.guid === CredentialGUIs.EnvironmentGUID
          ? 'codicon-bracket'
          : 'codicon-key'
      "
      align-icon-with-twisty
      :data-vscode-context="vscodeContext(credential)"
    />
  </TreeSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import TreeSection from "src/components/tree/TreeSection.vue";
import TreeItem from "src/components/tree/TreeItem.vue";
import WelcomeView from "src/components/WelcomeView.vue";
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

import { Credential } from "../../../../../src/api";
import { CredentialGUIs } from "../../../../../src/constants";
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import { ActionButton } from "../ActionToolbar.vue";

const home = useHomeStore();
const sectionExpanded = ref<boolean>(false);

const { sendMsg } = useHostConduitService();

const onClickAlert = () => {
  sectionExpanded.value = true;
};

const credentialsHeaderActions = computed((): ActionButton[] => {
  if (home.credentialsAlert) {
    return [
      {
        label: "Action Required!",
        codicon: "codicon-alert",
        fn: onClickAlert,
      },
    ];
  }
  return [];
});

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

const showWelcomeView = computed(() => {
  return home.alertNoCredentials;
});

const vscodeContext = (credential: Credential) => {
  if (credential.guid === CredentialGUIs.EnvironmentGUID) {
    return undefined;
  }

  return JSON.stringify({
    credentialGUID: credential.guid,
    credentialName: credential.name,
    webviewSection: "credentials-tree-item",
    preventDefaultContextMenuItems: true,
  });
};
</script>
