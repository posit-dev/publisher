<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <DeploymentHeader
    v-if="deployment && !isDeploymentError(deployment) && defaultConfig"
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
      :previous-config="isDeployment(deployment) ? deployment : undefined"
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
import { useDeploymentStore } from 'src/stores/deployments';

import {
  Configuration,
  ConfigurationError,
  isConfigurationError,
  useApi,
  isDeployment
} from 'src/api';
import { isDeploymentError } from 'src/api/types/deployments';
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
const deployments = useDeploymentStore();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

const props = defineProps({
  preferredAccount: { type: String, required: false, default: undefined },
});

const deploymentName = computed(():string => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.name)) {
    return route.params.name[0];
  }
  return route.params.name;
});

const deployment = computed(() => {
  return deployments.deploymentMap[deploymentName.value];
});

watch(
  () => deployment.value,
  () => {
    if (!deployment.value || isDeploymentError(deployment.value)) {
      // go to fatal error page.
      router.push(newFatalErrorRouteLocation(
        new Error('Invalid Value for Deployment Object'),
        'DeploymentPage::deployment()',
      ));
    }
  }
);

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

const defaultConfig = computed(() => {
  return configurations.value.find((c) => c.configurationName === 'default');
});

async function getConfigurations() {
  const response = await api.configurations.getAll();
  configurations.value = response.data;
}
getConfigurations();
</script>
