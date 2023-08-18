<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { useLogger } from './utils/logger';
import { useRouter, useRoute } from 'vue-router';

const logger = useLogger();
const router = useRouter();
const route = useRoute();

const api = useApi();
const deploymentStore = useDeploymentStore();

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

const handleQueryParams = async() => {
  // router is async so we wait for it to be ready
  await router.isReady();

  // debug
  if ('debug' in route.query) {
    logger.enableLogging('DEBUG');
  }
};

onMounted(async() => {
  await handleQueryParams();
  await getInitialDeploymentState();
});

</script>
