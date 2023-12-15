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

      <PButton
        v-if="hasDeployments"
        hierarchy="primary"
        :to="{ name: 'addNewDeployment' }"
      >
        Add Destination
      </PButton>
    </div>

    <div
      v-if="hasDeployments"
      class="card-grid"
    >
      <DeploymentCard
        v-for="deployment in deployments"
        :key="deployment.id"
        :deployment="deployment"
      />
    </div>
    <div v-else>
      <PCard
        :to="{ name: 'addNewDeployment' }"
      >
        <div class="flex column items-center">
          <q-icon
            name="add"
            size="2rem"
          />
          <h3 class="text-body1 text-weight-medium q-mt-sm">
            Add a New Destination
          </h3>
          <p class="q-mt-xs text-low-contrast">
            This project hasn't been published yet.
          </p>
          <p class="text-low-contrast">
            Get started by adding a destination.
          </p>
        </div>
      </PCard>
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
import { computed, ref } from 'vue';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';
import { Configuration, ConfigurationError } from 'src/api/types/configurations';
import ConfigCard from './ConfigCard.vue';
import DeploymentCard from './DeploymentCard.vue';
import FileTree from 'src/components/FileTree.vue';
import PButton from 'src/components/PButton.vue';
import PCard from 'src/components/PCard.vue';

const api = useApi();
const deployments = ref<Deployment[]>([]);
const configurations = ref<Array<Configuration | ConfigurationError>>([]);

const hasDeployments = computed(() => {
  return deployments.value.length > 0;
});

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

console.log('Sending window parent the message', window.parent);
window.parent.postMessage({ command: 'alert', text: 'it worked' }, '*');
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
