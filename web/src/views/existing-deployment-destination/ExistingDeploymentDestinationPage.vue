<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ExistingDeploymentDestinationHeader
    :content-id="contentID"
    :url="deploymentUrl"
    class="q-mt-md"
  />

  <ConfigSettings
    v-if="deployment"
    :config="deployment"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';

import ConfigSettings from 'src/components/ConfigSettings.vue';
import ExistingDeploymentDestinationHeader from './ExistingDeploymentDestinationHeader.vue';

const route = useRoute();
const api = useApi();

const deployment = ref<Deployment>();

const deploymentID = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

const deploymentUrl = computed<string>(() => {
  return deployment.value?.serverUrl || '';
});

const contentID = computed(():string => {
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

const getDeployment = async() => {
  try {
    if (!deploymentID.value) {
      deployment.value = undefined;
      return;
    }
    const response = await api.deployments.get(deploymentID.value);
    const d = response.data;
    if (isDeploymentError(d)) {
      throw new Error(`API Error /deployment/${deploymentID.value}: ${d}`);
    }
    deployment.value = d;
  } catch (err) {
    // TODO: handle the API error
  }
};

watch(
  () => route.params,
  () => {
    getDeployment();
  },
  { immediate: true }
);

</script>
