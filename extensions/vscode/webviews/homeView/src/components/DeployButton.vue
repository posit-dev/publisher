<template>
  <vscode-button
    :data-automation="`deploy-button`"
    :disabled="!haveResources || isConfigInError || home.publishInProgress"
    @click="deploy"
  >
    Deploy Your Project
  </vscode-button>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isConfigurationError } from "../../../../src/api";
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

const isConfigInError = computed(() => {
  return Boolean(
    home.selectedConfiguration &&
      isConfigurationError(home.selectedConfiguration),
  );
});

const deploy = () => {
  if (
    !home.selectedContentRecord ||
    !home.selectedConfiguration ||
    !home.serverCredential
  ) {
    console.error(
      "DeployButton::deploy trying to send message with undefined values. Action ignored.",
    );
    return;
  }

  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.DEPLOY,
    content: {
      deploymentName: home.selectedContentRecord.saveName,
      configurationName: home.selectedConfiguration.configurationName,
      credentialName: home.serverCredential.name,
      projectDir: home.selectedContentRecord.projectDir,
    },
  });
};
</script>
