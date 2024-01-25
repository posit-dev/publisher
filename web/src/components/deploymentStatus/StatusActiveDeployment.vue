<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    v-if="compact"
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
  >
    <p v-if="isDeployment(deployment)">
      {{ deployment.id }}
    </p>
    <div
      v-if="showProgress"
      class="summary row items-center"
    >
      <div class="col q-ml-sm">
        <q-spinner-grid
          color="primary"
          size="2rem"
        />
      </div>
      <div class="col-10 text-left">
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

const events = useEventStore();

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

</script>
