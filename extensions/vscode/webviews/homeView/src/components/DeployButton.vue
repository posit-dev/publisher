<template>
  <vscode-button
    :data-automation="`deploy-button`"
    :disabled="disableDeploy"
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

const disableDeploy = computed(
  () =>
    !haveResources.value ||
    home.publishInProgress ||
    home.publishInitiated ||
    home.contentRenderInProgress,
);

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

  // If there is any render error message, clear that up
  home.contentRenderFailed = false;

  // stop the user from double clicking the deploy button by mistake
  home.publishInitiated = true;

  // Only send up secrets that have values
  const secrets: Record<string, string> = {};
  home.secrets.forEach((value, name) => {
    if (value) {
      secrets[name] = value;
    }
  });

  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.DEPLOY,
    content: {
      deploymentName: home.selectedContentRecord.saveName,
      configurationName: home.selectedConfiguration.configurationName,
      credentialName: home.serverCredential.name,
      projectDir: home.selectedContentRecord.projectDir,
      secrets: secrets,
    },
  });
};
</script>
