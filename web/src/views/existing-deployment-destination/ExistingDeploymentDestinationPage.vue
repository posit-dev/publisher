<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ExistingDeploymentDestinationHeader
    v-if="deployment"
    :content-id="deployment.id"
    :url="deploymentUrl"
  />

  <div class="publisher-layout q-pb-xl space-between-lg">
    <ConfigSettings
      v-if="deployment"
      :config="deployment"
    />

    <h2 class="text-h6">
      Files
    </h2>
    <FileTree />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';
import { routeToErrorPage, getErrorMessage } from 'src/util/errors';

import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import ExistingDeploymentDestinationHeader from './ExistingDeploymentDestinationHeader.vue';

const route = useRoute();
const router = useRouter();
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
      routeToErrorPage(
        router,
        `API Error /deployment/${deploymentName.value}: ${d}`,
        'ExistingDeploymentDestinationPage::getDeployment'
      );
      return;
    }
    deployment.value = d;
  } catch (err: unknown) {
    // Fatal!
    routeToErrorPage(
      router,
      getErrorMessage(err),
      'ExistingDeploymentDestinationPage::getDeployment'
    );
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
