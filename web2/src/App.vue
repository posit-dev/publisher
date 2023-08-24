<template>
  <q-layout
    view="hHh lpR fFf"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="max-width-md q-mx-auto">
        <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <q-toolbar-title>
          Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page
        class="max-width-md q-mx-auto"
        padding
      >
        <h6 class="q-mt-none q-mb-md">
          What would you like to be published and how?
        </h6>
        <q-list
          dark
          bordered
          class="rounded-borders"
        >
          <DestinationTarget />
          <q-separator />
          <FilesToPublish />
          <q-separator />
          <PythonProject />
          <q-separator />
          <CommonSettings />
          <q-separator />
          <AdvancedSettings />
        </q-list>
        <PublishProcess />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import DestinationTarget from 'src/components/panels/DestinationTarget.vue';
import FilesToPublish from 'src/components/panels/FilesToPublish.vue';
import PythonProject from 'src/components/panels/PythonProject.vue';
import CommonSettings from 'src/components/panels/CommonSettings.vue';
import AdvancedSettings from 'src/components/panels/AdvancedSettings.vue';
import PublishProcess from 'src/components/PublishProcess.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

const api = useApi();
const deploymentStore = useDeploymentStore();

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
