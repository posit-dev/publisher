<template>
  <TreeSection
    title="IntegrationRequests"
    data-automation="publisher-integrationRequests-section"
    :actions="sectionActions"
  >
    <WelcomeView v-if="!home.integrationRequests.length">
      <p>No integrationRequests have been added yet.</p>
    </WelcomeView>
    <TreeItem
      v-else
      v-for="integrationRequest in home.integrationRequests"
      :title="integrationRequest.name"
      :description="integrationRequest.description"
      :data-automation="`${JSON.stringify(integrationRequest)}-list`"
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

const home = useHomeStore();

const credentialName = home.serverCredential!.name;

const { sendMsg } = useHostConduitService();

const sectionActions = computed(() => {
  return [
    {
      label: "Add Integration Request",
      codicon: "codicon-add",
      fn: () => {
        sendMsg({
          kind: WebviewToHostMessageType.ADD_INTEGRATION_REQUEST,
          content: {
            accountName: credentialName,
          }
        });
      },
    },
    // {
    //   label: "Refresh Integration Requests",
    //   codicon: "codicon-refresh",
    //   fn: () => {
    //     sendMsg({ kind: WebviewToHostMessageType.REQUEST_CREDENTIALS });
    //   },
    // },
  ];
});
</script>
