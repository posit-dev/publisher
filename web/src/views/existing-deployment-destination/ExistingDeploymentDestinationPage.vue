<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ExistingDeploymentDestinationHeader
    :content-id="contentID"
    :url="deploymentUrl"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useApi } from 'src/api';
import { isDeploymentError } from 'src/api/types/deployments';

import ExistingDeploymentDestinationHeader from './ExistingDeploymentDestinationHeader.vue';

const route = useRoute();
const api = useApi();

// We do not know what the right account is to select.
const deploymentUrl = ref('');

const deploymentID = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

const contentID = computed(():string => {
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

const determineDeploymentURL = async() => {
  try {
    if (!deploymentID.value) {
      return;
    }
    const deployment = (await api.deployments.get(deploymentID.value)).data;
    if (isDeploymentError(deployment)) {
      throw new Error(`API Error /deployment/${deploymentID.value}: ${deployment}`);
    }
    deploymentUrl.value = deployment.serverUrl;
  } catch (err) {
    // TODO: handle the API error
  }
};

watch(
  () => route.params,
  () => {
    determineDeploymentURL();
  },
  { immediate: true }
);

</script>
