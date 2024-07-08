<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <template v-if="home.gitRefreshError">
      <div class="desc">Git Usage Detected</div>
      <ul class="ul">
        <li>Error: {{ home.gitRefreshError }}</li>
      </ul>
    </template>
    <template v-else>
      <div class="desc">Git Usage Detected</div>
      <ul class="ul">
        <li>Repo: {{ home.gitRepo }}</li>
        <li>Branch: {{ home.gitRepoLocalBranch }}</li>
      </ul>
      <!-- <li>Repo Commit: {{ home.gitRepoLocalCommit }}</li>
        <li>Repo Pending Changes: {{ home.gitRepoNumberOfChanges }}</li> -->
    </template>
    <vscode-button class="w-full" @click="deploy">
      Publish to Connect Cloud</vscode-button
    >
  </div>
</template>

<script setup lang="ts">
import { useHostConduitService } from "src/HostConduitService";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";
import { useHomeStore } from "src/stores/home";

const hostConduit = useHostConduitService();
const home = useHomeStore();

hostConduit.sendMsg({ kind: WebviewToHostMessageType.REFRESH_GIT_STATUS });

//staging.connect.posit.cloud/publish?contentType=streamlit&sourceRepositoryURL=https%3A%2F%2Fgithub.com%2Fatzt%2Fstreamlit-example&sourceRef=master&sourceRefType=branch&primaryFile=streamlit_app.py&pythonVersion=3.10&secrets=VAR_1%3AVALUE_1%2CVAR_2%3AVALUE_2

const deploy = () => {
  if (!home.gitRepoUrl || !home.gitRepoLocalBranch) {
    return;
  }
  const cloudPublishUrl = `https://connect.posit.cloud/publish?sourceRepositoryURL=${encodeURIComponent(home.gitRepoUrl)}&sourceRef=${encodeURIComponent(home.gitRepoLocalBranch)}&sourceRefType=branch`;
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NAVIGATE,
    content: {
      uriPath: cloudPublishUrl,
    },
  });
  console.log(`Navigating (external window) to ${cloudPublishUrl}`);
};
</script>
<style lang="scss" scoped>
.cloud-container {
  padding: 0 0;
  margin: 0 0;
  //margin-block-end: 1rem;
  // font-size: 0.9em;
}
.ul {
  display: block;
  list-style-type: square;
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
