<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl">
    <q-breadcrumbs>
      <q-breadcrumbs-el>
        <PLink :to="{ name: 'project' }">
          Project
        </PLink>
      </q-breadcrumbs-el>
      <q-breadcrumbs-el>
        <PLink :to="{ name: 'deployments', params: { name: name }}">
          Deploy
        </PLink>
      </q-breadcrumbs-el>
      <q-breadcrumbs-el
        label="Progress"
      />
    </q-breadcrumbs>
    <div
      class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
    >
      <div
        v-if="showDeployInProgress"
        class="space-between-y-sm"
      >
        <h1
          v-if="name"
          class="text-h6"
        >
          {{ name }}
        </h1>
        <p>
          {{ operation }}
        </p>
        <p v-if="id">
          {{ id }}
        </p>
        <DeployStepper class="q-mt-xl" />
      </div>
      <div v-else>
        <h1 class="text-h6">
          Deployment Logs
        </h1>
        <p>for this deployment can be viewed on the Posit Connect server.</p>
        <a
          :href="connectLogLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          View deployment logs on Connect
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEventStore } from 'src/stores/events';

import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';
import PLink from 'src/components/PLink.vue';
import { useDeploymentStore } from 'src/stores/deployments';
import { isDeployment, isDeploymentError } from 'src/api';

const eventStore = useEventStore();
const deployments = useDeploymentStore();

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
});

const id = computed(() => {
  return eventStore.currentPublishStatus.contentId;
});

const deployment = deployments.getDeploymentRef(props.name);

const operation = computed(() => {
  if (!deployment.value) {
    return undefined;
  }
  if (isDeploymentError(deployment.value)) {
    return undefined;
  }
  return `Deploying to: ${deployment.value.serverUrl}`;
});

const connectLogLink = computed(() => {
  if (!isDeployment(deployment.value)) {
    return undefined;
  }
  return `${deployment.value.dashboardUrl}/logs`;
});

const showDeployInProgress = computed(() => {
  if (!deployment.value || isDeploymentError(deployment.value)) {
    return false;
  }
  if (deployment) {
    return eventStore.doesPublishStatusApplyToDeployment(deployment.value.deploymentName);
  }
  return false;
});

</script>

<style scoped lang="scss">
.click-target {
  cursor: pointer;
}
</style>
