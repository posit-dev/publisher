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
    <div class="config-grid">
      <ConfigCard
        v-for="config in configurations"
        :key="config.configurationName"
        :config="config"
      />
    </div>

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
import { Configuration, ConfigurationError } from 'src/api/types/configurations';
import { sendErrorToFatalErrorComponent } from 'src/util/errors';
import { useRouter } from 'vue-router';

import ConfigCard from './ConfigCard.vue';
import DeploymentCard from './DeploymentCard.vue';
import FileTree from 'src/components/FileTree.vue';

const api = useApi();
const router = useRouter();
const deployments = ref<Deployment[]>([]);
const configurations = ref<Array<Configuration | ConfigurationError>>([]);

async function getDeployments() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = (await api.deployments.getAll()).data;
    deployments.value = response.filter<Deployment>((d): d is Deployment => {
      return !isDeploymentError(d);
    });
  } catch (error: unknown) {
    sendErrorToFatalErrorComponent(error, router, 'ProjectPage::getDeployments()');
  }
}

async function getConfigurations() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = await api.configurations.getAll();
    configurations.value = response.data;
  } catch (error: unknown) {
    sendErrorToFatalErrorComponent(error, router, 'ProjectPage::getConfigurations()');
  }
}

getDeployments();
getConfigurations();
</script>

<style scoped lang="scss">
.card-grid {
  display: grid;
  grid-gap: 28px;
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 800px) {
  .card-grid {
    grid-template-columns: repeat(1, 1fr);
  }
}

.config-grid {
  display: grid;
  grid-gap: 28px;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 800px) {
  .config-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
