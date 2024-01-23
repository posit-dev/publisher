<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="flex items-center justify-between">
    <div class="col">
      <h2 class="text-h6">
        Deployments
      </h2>
      <p
        v-if="deployments.hasDeployments"
        class="q-mt-xs"
      >
        Your project has been deployed to:
      </p>
    </div>
    <PButton
      v-if="deployments.hasDeployments"
      hierarchy="primary"
      :to="{ name: 'addNewDeployment' }"
    >
      New Deployment
    </PButton>
  </div>
  <div
    v-if="deployments.hasDeployments"
    class="card-grid"
  >
    <div
      v-for="deployment in deployments.sortedDeployments"
      :key="deployment.deploymentName"
    >
      <DeploymentErrorCard
        v-if="isDeploymentError(deployment)"
        :deployment-error="deployment"
      />
      <PreDeploymentCard
        v-if="isPreDeployment(deployment)"
        :pre-deployment="deployment"
      />
      <DeploymentCard
        v-if="!isDeploymentError(deployment) && !isPreDeployment(deployment)"
        :deployment="deployment"
      />
    </div>
  </div>
  <div v-else>
    <PCard
      :to="{ name: 'addNewDeployment' }"
      data-automation="add-new-deployment"
    >
      <div class="flex column items-center">
        <q-icon
          name="add"
          size="2rem"
        />
        <h3 class="text-body1 text-weight-medium q-mt-sm">
          Add a New Deployment
        </h3>
        <p class="q-mt-xs text-low-contrast">
          This project hasn't been deployed yet.
        </p>
        <p class="text-low-contrast">
          Get started by adding a new deployment.
        </p>
      </div>
    </PCard>
  </div>
</template>

<script setup lang="ts">
import { useDeploymentStore } from 'src/stores/deployments';
import { isDeploymentError, isPreDeployment } from 'src/api';

import DeploymentCard from './DeploymentCard.vue';
import PreDeploymentCard from './PreDeploymentCard.vue';
import DeploymentErrorCard from './DeploymentErrorCard.vue';
import PButton from 'src/components/PButton.vue';
import PCard from 'src/components/PCard.vue';

const deployments = useDeploymentStore();

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
</style>
