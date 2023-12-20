<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ExistingDeploymentHeader
    v-if="deployment"
    :deployment="deployment"
  />
  <DeploymentSection
    v-if="deployment"
    title="Configuration"
    :subtitle="deployment.configurationName"
  >
    <ConfigSettings
      v-if="defaultConfig"
      :config="defaultConfig"
    />
  </DeploymentSection>
  <DeploymentSection
    title="Files"
    subtitle="The files for this project. Ignored files will not be part of your deployments."
  >
    <FileTree />
  </DeploymentSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Configuration, ConfigurationError, useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';
import {
  newFatalErrorRouteLocation,
} from 'src/util/errors';

import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import ExistingDeploymentHeader from './ExistingDeploymentHeader.vue';
import DeploymentSection from 'src/components/DeploymentSection.vue';

const route = useRoute();
const router = useRouter();
const api = useApi();

const deployment = ref<Deployment>();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

const deploymentName = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.name)) {
    return route.params.name[0];
  }
  return route.params.name;
});

const getDeployment = async() => {
  try {
    if (!deploymentName.value) {
      deployment.value = undefined;
      return;
    }
    // API Returns:
    // 200 - success
    // 404 - not found
    // 500 - internal server error
    const response = await api.deployments.get(deploymentName.value);
    const d = response.data;
    if (isDeploymentError(d)) {
      // let the fatal error page handle this deployment error.
      // we're in a header, they can't fix it here.
      throw new Error(d.error);
    } else {
      deployment.value = d;
    }
  } catch (error: unknown) {
    // For this page, we send all errors to the fatal error page, including 404
    router.push(newFatalErrorRouteLocation(error, 'ExistingDeploymentPage::getDeployment()'));
  }
};

const defaultConfig = computed(() => {
  return configurations.value.find((c) => c.configurationName === 'default');
});

async function getConfigurations() {
  const response = await api.configurations.getAll();
  configurations.value = response.data;
}

getConfigurations();

watch(
  () => route.params,
  () => {
    getDeployment();
  },
  { immediate: true }
);

</script>
