<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    v-if="deployInProgress"
    class="flex items-center"
    :class="textClass"
  >
    <q-spinner
      color="primary"
      size="1rem"
    />
    <div class="q-ml-sm text-left">
      {{ eventStore.summaryOfCurrentPublishingProcess.operation }} :
      {{ eventStore.summaryOfCurrentPublishingProcess.stepStatus }}
    </div>
  </div>
  <div
    v-if="showDeployError"
    class="flex items-center"
    :class="textClass"
  >
    <q-icon
      name="error"
      size="1rem"
    />
    <div class="q-ml-sm text-left text-bold">
      Deploying Operation has failed.
    </div>
  </div>
</template>

<script setup lang="ts">

import { useEventStore } from 'src/stores/events';
import { PropType, computed } from 'vue';
import { useQuasar } from 'quasar';
import { Deployment } from 'src/api';

const eventStore = useEventStore();
const $q = useQuasar();

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});

const completion = computed(() => {
  return eventStore.currentPublishStatus.status.completion;
});

const deployInProgress = computed(() => {
  return eventStore.isPublishActiveForDeployment(props.deployment.saveName);
});

const showDeployError = computed(() => {
  return (
    eventStore.doesPublishStatusApplyToDeployment(props.deployment.saveName)
    &&
    completion.value === 'error'
  );
});

const textClass = computed(() => {
  if ($q.dark.isActive) {
    return 'text-white';
  }
  return 'text-black';
});

</script>
