<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard
    :to="toLink"
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
import { PropType, computed } from 'vue';

import { Deployment, DeploymentError, PreDeployment, isDeploymentError } from 'src/api';
import PCard from 'src/components/PCard.vue';
import DeploymentStatus from 'src/components/deploymentStatus/DeploymentStatus.vue';
import { RouteLocationRaw } from 'vue-router';

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment | PreDeployment | DeploymentError>,
    required: true,
  },
});

const toLink = computed((): RouteLocationRaw | undefined => {
  if (!isDeploymentError(props.deployment)) {
    return {
      name: 'deployments',
      params: {
        name: `${props.deployment.deploymentName}`,
      },
    };
  }
  return undefined;
});

</script>
