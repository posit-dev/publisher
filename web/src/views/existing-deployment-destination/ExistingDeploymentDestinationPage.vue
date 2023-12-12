<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ExistingDeploymentDestinationHeader
    v-if="deployment"
    :content-id="deployment.id"
    :url="deploymentUrl"
  />

  <DeploymentSection
    v-if="deployment"
    title="Configuration"
    :subtitle="deployment.configurationName"
  >
    <ConfigSettings
      :config="deployment"
    />
  </DeploymentSection>
  <DeploymentSection
    title="Files"
  >
    <FileTree />
  </DeploymentSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';

import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import ExistingDeploymentDestinationHeader from './ExistingDeploymentDestinationHeader.vue';
import DeploymentSection from 'src/components/DeploymentSection.vue';

const route = useRoute();
const api = useApi();

const deployment = ref<Deployment>();

const deploymentName = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.name)) {
    return route.params.name[0];
  }
  return route.params.name;
});

const deploymentUrl = computed<string>(() => {
  return deployment.value?.serverUrl || '';
});

const getDeployment = async() => {
  try {
    if (!deploymentName.value) {
      deployment.value = undefined;
      return;
    }
    const response = await api.deployments.get(deploymentName.value);
    const d = response.data;
    if (isDeploymentError(d)) {
      throw new Error(`API Error /deployment/${deploymentName.value}: ${d}`);
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
