<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main class="container">
    <Tabs @change="tabChanged" v-model="activeTab">
      <Tab :value="ViewTabs.OnPrem">
        <OnPremConnect />
      </Tab>
      <Tab :value="ViewTabs.Cloud">
        <CloudConnect />
      </Tab>
    </Tabs>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

import OnPremConnect from "src/views/OnPremConnect.vue";
import CloudConnect from "src/views/CloudConnect.vue";
import { Tabs, Tab } from "super-vue3-tabs";

import { useHostConduitService } from "src/HostConduitService";

enum ViewTabs {
  OnPrem = "Connect",
  Cloud = "Connect Cloud",
}
const activeTab = ref<ViewTabs>(ViewTabs.OnPrem);

const tabChanged = (tab: ViewTabs) => {
  console.log("Tab changed to", tab);
};

useHostConduitService();
</script>
<style lang="scss" scoped>
.container {
  margin: 0 10px;
}
</style>
