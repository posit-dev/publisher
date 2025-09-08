<template>
  <vscode-button
    :data-automation="`render-button`"
    :disabled="home.contentRenderInProgress"
    @click="render"
  >
    Render Your Project
  </vscode-button>
</template>

<script setup lang="ts">
import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

const home = useHomeStore();
const hostConduit = useHostConduitService();
const render = () => {
  home.contentRenderError = undefined;
  home.contentRenderInProgress = true;
  home.contentRenderFinished = false;
  hostConduit.sendMsg({ kind: WebviewToHostMessageType.RENDER_CONTENT });
};
</script>
