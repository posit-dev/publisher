<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-y-sm">
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
    <template v-if="showDeployInProgress">
      <div class="flex justify-between q-mt-md row-gap-lg column-gap-xl">
        <div class="space-between-y-sm">
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
        </div>
      </div>
      <DeployStepper class="q-mt-xl" />
    </template>
    <template v-else>
      <h1
        v-if="name"
        class="text-h6"
      >
        {{ name }}
      </h1>
      <p>Deployment Logs can be viewed on the Posit Connect server.</p>
      <p>
        <a
          :href="connectLogLink"
          target="_blank"
          rel="noopener noreferrer"
        >View deployment logs on Connect</a>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useEventStore } from 'src/stores/events';

import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';
import PLink from 'src/components/PLink.vue';
import { useDeploymentStore } from 'src/stores/deployments';
import { isDeployment, isDeploymentError, isPreDeployment } from 'src/api';
import { useRouter } from 'vue-router';
import { newFatalErrorRouteLocation } from 'src/utils/errors';

const eventStore = useEventStore();
const deployments = useDeploymentStore();
const router = useRouter();

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

watch(
  deployment,
  () => {
    if (isPreDeployment(deployment.value)) {
      router.push(newFatalErrorRouteLocation(
        new Error('Attempting to show progress of PreDeployment object'),
        'DeployProgressPage: watch deployment'
      ));
    }
  },
  { immediate: true },
);

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
