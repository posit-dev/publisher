<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main class="container">
    <template v-if="home.gitRepo">
      <Tabs @change="tabChanged" v-model="activeTab">
        <Tab :value="ViewTabs.OnPrem">
          <OnPremConnect />
        </Tab>
        <Tab :value="ViewTabs.Cloud">
          <CloudConnect />
        </Tab>
      </Tabs>
    </template>
    <template v-else>
      <OnPremConnect />
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import OnPremConnect from "src/views/OnPremConnect.vue";
import CloudConnect from "src/views/CloudConnect.vue";
import { Tabs, Tab } from "super-vue3-tabs";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "./stores/home";
import { WebviewToHostMessageType } from "../../../src/types/messages/webviewToHostMessages";

enum ViewTabs {
  OnPrem = "Connect",
  Cloud = "Connect Cloud",
}
const activeTab = ref<ViewTabs>(ViewTabs.OnPrem);

const tabChanged = (tab: ViewTabs) => {
  console.log("Tab changed to", tab);
};

const hostConduit = useHostConduitService();
const home = useHomeStore();

hostConduit.sendMsg({ kind: WebviewToHostMessageType.REFRESH_GIT_STATUS });
</script>
<style lang="scss" scoped>
.container {
  margin: 0 10px;
}
</style>
