<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="hHh lpR fFf"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="max-width-md q-pa-none">
        <!-- <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        /> -->
        <AppMenu />
        <q-toolbar-title class="q-pl-xs">
          Posit Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <ConfigurePublish
        v-if="currentView === 'configure'"
        @publish="onPublish"
      />
      <PublishContent
        v-if="currentView === 'publish'"
        @back="onConfigure"
      />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">

import { ref } from 'vue';

import AppMenu from 'src/components/AppMenu.vue';
import ConfigurePublish from 'src/components/configurePublish/ConfigurePublish.vue';
import PublishContent from 'src/components/publishProcess/PublishContent.vue';
// import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

type viewType = 'configure' | 'publish';

const currentView = ref(<viewType>'configure');
const api = useApi();
const deploymentStore = useDeploymentStore();

const onPublish = () => {
  currentView.value = 'publish';
};
const onConfigure = () => {
  currentView.value = 'configure';
};

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

getInitialDeploymentState();
</script>

<style lang="scss" scoped>
.posit-logo {
  max-height: 26px;
  width: auto;
}
</style>
