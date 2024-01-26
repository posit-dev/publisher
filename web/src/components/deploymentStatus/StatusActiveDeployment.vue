<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    v-if="compact"
    class="flex items-center"
    :class="textClass"
  >
    <q-spinner
      color="primary"
      size="1rem"
    />
    <div class="q-ml-sm text-left">
      {{ events.summaryOfCurrentPublishingProcess.operation }} :
      {{ events.summaryOfCurrentPublishingProcess.stepStatus }}
    </div>
  </div>
  <div
    v-else
    class="space-between-y-sm"
  >
    <p v-if="isDeployment(deployment)">
      {{ deployment.id }}
    </p>
    <div
      v-if="showProgress"
      class="flex items-center"
    >
      <q-spinner-grid
        color="primary"
        size="2rem"
      />
      <div class="q-ml-md space-between-y-sm">
        <div class="text-bold">
          Deploying project...
        </div>
        <div>
          {{ events.summaryOfCurrentPublishingProcess.operation }}
        </div>
        <div class="text-caption">
          {{ events.summaryOfCurrentPublishingProcess.stepStatus }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Deployment, PreDeployment } from 'src/api';
import { PropType, computed } from 'vue';
import { useEventStore } from 'src/stores/events';
import { isDeployment } from 'src/api/types/deployments';
import { useQuasar } from 'quasar';

const events = useEventStore();
const $q = useQuasar();

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment | PreDeployment>,
    required: true,
  },
  compact: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const showProgress = computed(() => {
  return events.doesPublishStatusApplyToDeployment(props.deployment.deploymentName);
});

const textClass = computed(() => {
  if ($q.dark.isActive) {
    return 'text-white';
  }
  return 'text-black';
});
</script>
