<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <StatusPreDeployment
    v-if="isPreDeployment(deployment) && !isActiveDeployment(deployment)"
    :deployment="deployment"
    :compact="compact"
  />
  <StatusErrorPreDeployment
    v-if="isUnsuccessfulPreDeployment(deployment) && !isActiveDeployment(deployment)"
    :deployment="deployment"
    :compact="compact"
  />
  <StatusSuccessDeployment
    v-if="isSuccessfulDeployment(deployment) && !isActiveDeployment(deployment)"
    :deployment="deployment"
  />
  <StatusErrorDeployment
    v-if="isUnsuccessfulDeployment(deployment) && !isActiveDeployment(deployment)"
    :deployment="deployment"
    :compact="compact"
  />
  <StatusActiveDeployment
    v-if="isActiveDeployment(deployment)"
    :deployment="deployment"
    :compact="compact"
  />
  <DeploymentLogLink
    :deployment="deployment"
  />
</template>

<script setup lang="ts">
import { useDeploymentStore } from 'src/stores/deployments';
import { useEventStore } from 'src/stores/events';
import {
  Deployment,
  DeploymentError,
  DeploymentState,
  PreDeployment,
  isPreDeployment,
  isUnsuccessfulPreDeployment,
  isSuccessfulDeployment,
  isUnsuccessfulDeployment,
} from 'src/api';

import StatusActiveDeployment from './StatusActiveDeployment.vue';
import StatusErrorDeployment from './StatusErrorDeployment.vue';
import StatusPreDeployment from './StatusPreDeployment.vue';
import StatusSuccessDeployment from './StatusSuccessDeployment.vue';
import StatusErrorPreDeployment from './StatusErrorPreDeployment.vue';
import DeploymentLogLink from '../DeploymentLogLink.vue';

const deployments = useDeploymentStore();
const events = useEventStore();

// Will show either:
// - never deployed (pre-deployment)
// - previously deployed success (deployment)
// - previously deployed error (deployment)
// - actively being deployed (deployment in event store)

const props = defineProps({
  name: { type: String, required: true },
  compact: { type: Boolean, required: false, default: false },
});

const deployment = deployments.getDeploymentRef(props.name);

const isActiveDeployment = (
  d: Deployment | PreDeployment | DeploymentError,
): d is Deployment => {
  return (
    d.state === DeploymentState.DEPLOYED &&
    events.isPublishActiveForDeployment(props.name)
  );
};

</script>
