<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <DeploymentHeader
    v-if="deployment && defaultConfig"
    :deployment="deployment"
    :config-error="isConfigurationError(defaultConfig) ? defaultConfig : undefined"
    :preferred-account="props.preferredAccount"
  />
  <DeploymentSection
    v-if="deployment"
    title="Configuration"
    :subtitles="configurationSubTitles"
  >
    <ConfigSettings
      v-if="defaultConfig"
      :config="defaultConfig"
    />
  </DeploymentSection>

  <DeploymentSection
    v-if="deployment"
    title="Files"
    :subtitles="fileSubTitles"
  >
    <FileTree />
  </DeploymentSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Configuration, ConfigurationError, isConfigurationError, useApi } from 'src/api';
import { Deployment, PreDeployment, isDeploymentRecordError } from 'src/api/types/deployments';
import {
  newFatalErrorRouteLocation,
} from 'src/utils/errors';

import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentSection from 'src/components/DeploymentSection.vue';

const route = useRoute();
const router = useRouter();
const api = useApi();

const deployment = ref<Deployment | PreDeployment>();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

const props = defineProps({
  preferredAccount: { type: String, required: false, default: '' },
});

const deploymentName = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.name)) {
    return route.params.name[0];
  }
  return route.params.name;
});

const configurationSubTitles = computed(() => {
  return [
    `Using ${defaultConfig.value?.configurationPath}`,
    `The settings present in this file are listed below and will be used during
      the next deployment of your project.`,
    `Edit this file to add or modify settings which will be applied
      during this project's next deployment.`,
  ];
});

const fileSubTitles = computed(() => {
  return [
    `The files detected for this project. Unless ignored, these files will be
      uploaded to the server each time you deploy this project.`,
    `NOTE: A .positignore file can be used to indicate which files should
      not be included in your deployments to the server.`,
  ];
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
    if (isDeploymentRecordError(d)) {
      // let the fatal error page handle this deployment error.
      // we're in a header, they can't fix it here.
      throw new Error(d.error.msg);
    } else {
      deployment.value = d;
    }
  } catch (error: unknown) {
    // For this page, we send all errors to the fatal error page, including 404
    router.push(newFatalErrorRouteLocation(error, 'DeploymentPage::getDeployment()'));
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
