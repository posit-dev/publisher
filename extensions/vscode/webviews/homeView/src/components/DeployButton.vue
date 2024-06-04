<template>
  <vscode-button
    :disabled="!haveResources || home.publishInProgress"
    @click="deploy"
  >
    Deploy Your Project
  </vscode-button>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";

import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

const home = useHomeStore();
const hostConduit = useHostConduitService();

const haveResources = computed(
  () =>
    Boolean(home.selectedContentRecord) &&
    Boolean(home.selectedConfiguration) &&
    Boolean(home.serverCredential),
);

const deploy = () => {
  if (
    !home.selectedContentRecord ||
    !home.selectedConfiguration ||
    !home.serverCredential
  ) {
    throw new Error(
      "DeployButton::deploy trying to send message with undefined values",
    );
  }

  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.DEPLOY,
    content: {
      contentRecordName: home.selectedContentRecord.saveName,
      configurationName: home.selectedConfiguration.configurationName,
      credentialName: home.serverCredential.name,
    },
  });
};
</script>
