<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div class="desc">
      Connect Cloud is a cloud environment to easily showcase your Python and R
      content.
    </div>
    <div class="desc">
      Quickly publish and share your work. Three Simple Steps. Three Minutes.
    </div>
    <ol class="ol">
      <li>Authenticate with GitHub</li>
      <li>Select the repo with your source code</li>
      <li>Deploy and share with the world</li>
    </ol>
    <vscode-button class="w-full" @click="deploy"> Get Started </vscode-button>
  </div>
</template>

<script setup lang="ts">
import { useHostConduitService } from "src/HostConduitService";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

const hostConduit = useHostConduitService();

const deploy = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NAVIGATE,
    content: {
      uriPath: "https://connect.posit.cloud/home",
    },
  });
};
</script>
<style lang="scss" scoped>
.cloud-container {
  padding: 0 0;
  margin: 0 0;
  //margin-block-end: 1rem;
  // font-size: 0.9em;
}
.ol {
  display: block;
  list-style-type: decimal;
  margin: 10px 0;
  // margin-block-start: 0.5em;
  // margin-block-end: 1em;
  // margin-inline-start: 0px;
  // margin-inline-end: 0px;
  padding-inline-start: 20px;
  // font-size: smaller;
}
.desc {
  display: block;
  margin: 10px 0;
  // font-size: 0.83em;
  // margin-block-start: 0.5em;
  // margin-block-end: 0.5em;
  // margin-inline-start: 0px;
  // margin-inline-end: 0px;
  // font-weight: normal;
}
</style>
