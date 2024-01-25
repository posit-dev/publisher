<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <template v-if="deployment">
    <StatusPreDeployment
      v-if="isSuccessfulPreDeployment(deployment) && !isActive(deployment)"
      :deployment="deployment"
      :compact="compact"
    />
    <StatusErrorPreDeployment
      v-if="isUnsuccessfulPreDeployment(deployment) && !isActive(deployment)"
      :deployment="deployment"
      :compact="compact"
    />
    <StatusSuccessDeployment
      v-if="isSuccessfulDeployment(deployment) && !isActive(deployment)"
      :deployment="deployment"
    />
    <StatusErrorDeployment
      v-if="isUnsuccessfulDeployment(deployment) && !isActive(deployment)"
      :deployment="deployment"
      :compact="compact"
    />
    <StatusActiveDeployment
      v-if="isActive(deployment)"
      :deployment="deployment"
      :compact="compact"
    />
    <StatusDeploymentFileError
      v-if="isDeploymentError(deployment)"
      :deployment="deployment"
      :compact="compact"
    />
    <DeploymentLogLink
      :deployment="deployment"
    />
  </template>
</template>

<script setup lang="ts">
import { useEventStore } from 'src/stores/events';
import {
  Deployment,
  DeploymentError,
  DeploymentState,
  PreDeployment,
  isSuccessfulPreDeployment,
  isUnsuccessfulPreDeployment,
  isSuccessfulDeployment,
  isUnsuccessfulDeployment,
  isDeploymentError,
} from 'src/api';

import StatusActiveDeployment from './StatusActiveDeployment.vue';
import StatusErrorDeployment from './StatusErrorDeployment.vue';
import StatusSuccessDeployment from './StatusSuccessDeployment.vue';
import StatusErrorPreDeployment from './StatusErrorPreDeployment.vue';
import StatusDeploymentFileError from './StatusDeploymentFileError.vue';
import StatusPreDeployment from './StatusPreDeployment.vue';
import DeploymentLogLink from '../DeploymentLogLink.vue';
import { PropType } from 'vue';

const events = useEventStore();

// Will show either:
// - never deployed (pre-deployment)
// - previously deployed success (deployment)
// - previously deployed error (deployment)
// - actively being deployed (deployment in event store)

defineProps({
  deployment: {
    type: Object as PropType<Deployment | PreDeployment | DeploymentError>,
    required: true,
  },
  compact: { type: Boolean, required: false, default: false },
});

const isActive = (
  d: Deployment | PreDeployment | DeploymentError,
): d is Deployment | PreDeployment => {
  return (
    d.state !== DeploymentState.ERROR &&
    events.isPublishActiveForDeployment(d.deploymentName)
  );
};

</script>
