<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard
    :to="{ name: 'deployments', params: { name: `${deployment.deploymentName}` }}"
    :title="deployment.deploymentName"
  >
    <div class="space-between-y-sm">
      <p
        v-if="!isDeploymentError(deployment)"
      >
        {{ deployment.serverUrl }}
      </p>
      <DeploymentStatus
        :name="deployment.deploymentName"
        :compact="true"
      />
    </div>
  </PCard>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { Deployment, DeploymentError, PreDeployment, isDeploymentError } from 'src/api';
import PCard from 'src/components/PCard.vue';
import DeploymentStatus from 'src/components/deploymentStatus/DeploymentStatus.vue';

defineProps({
  deployment: {
    type: Object as PropType<Deployment | PreDeployment | DeploymentError>,
    required: true,
  },
});

</script>
