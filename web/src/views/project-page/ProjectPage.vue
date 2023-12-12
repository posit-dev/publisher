<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-lg">
    <q-breadcrumbs>
      <q-breadcrumbs-el label="Project" />
    </q-breadcrumbs>

    <div class="flex items-center justify-between">
      <h2 class="text-h6">
        Destinations
      </h2>

      <q-btn
        no-caps
        :to="{ name: 'addNewDeployment' }"
      >
        Add Destination
      </q-btn>
    </div>

    <div class="card-grid">
      <DeploymentCard
        v-for="deployment in deployments"
        :key="deployment.id"
        :deployment="deployment"
      />
    </div>

    <h2 class="text-h6">
      Configurations
    </h2>
    <ul
      v-for="config in configurations"
      :key="config.configurationName"
    >
      <li>
        {{ config.configurationName }}
        <span v-if="isConfigurationError(config)">
          {{ config.error }}
        </span>
      </li>
    </ul>

    <h2 class="text-h6">
      Files
    </h2>
    <FileTree />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';
import { Configuration, ConfigurationError, isConfigurationError } from 'src/api/types/configurations';
import DeploymentCard from './DeploymentCard.vue';
import FileTree from 'src/components/FileTree.vue';

const api = useApi();
const deployments = ref<Deployment[]>([]);
const configurations = ref<Array<Configuration | ConfigurationError>>([]);

async function getDeployments() {
  const response = (await api.deployments.getAll()).data;
  deployments.value = response.filter<Deployment>((d): d is Deployment => {
    return !isDeploymentError(d);
  });
}

async function getConfigurations() {
  const response = await api.configurations.getAll();
  configurations.value = response.data;
}

getDeployments();
getConfigurations();
</script>

<style scoped lang="scss">
.card-grid {
  display: grid;
  grid-gap: 28px;
}
</style>
