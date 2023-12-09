<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    style="min-width:100%; min-height: 5rem;"
  >
    <div
      v-if="publishInProgess"
      class="summary row q-ma-lg items-center"
    >
      <div class="col q-ml-sm">
        <q-spinner-grid
          color="primary"
          size="2rem"
        />
      </div>
      <div class="col-10 text-left">
        <div class="text-bold">
          Publishing project...
        </div>
        <div>
          {{ currentStepInfo.operation }}
        </div>
        <div class="text-caption">
          {{ currentStepInfo.stepStatus }}
        </div>
      </div>
    </div>
    <div
      v-if="showPublishSuccessSummary"
      class="q-ma-lg summary q-pa-sm row text-left items-center"
    >
      <div class="col q-ml-sm">
        <q-icon
          name="celebration"
          size="3rem"
        />
      </div>
      <div class="col-10 text-caption">
        <div class="text-bold">
          Publish was successful!
        </div>
        <div>
          Access Directly:
          <a
            :href="eventStore.currentPublishStatus.status.directURL"
            target="_blank"
            rel="noopener noreferrer"
          >
            URL
          </a>
        </div>
        <div>
          Access through Dashboard:
          <a
            :href="eventStore.currentPublishStatus.status.dashboardURL"
            target="_blank"
            rel="noopener noreferrer"
          >
            URL
          </a>
        </div>
      </div>
    </div>
    <div
      v-if="showPublishError"
      class="q-ma-lg error q-pa-sm row text-left items-center"
    >
      <div class="col q-ml-sm">
        <q-icon
          name="error"
          size="3rem"
        />
      </div>
      <div class="col-10 text-caption">
        <div class="text-bold">
          Publishing Operation has failed.
        </div>
        <div
          v-for="(array, index) in eventStore.currentPublishStatus.status.error"
          :key="index"
        >
          <span class="text-bold">
            {{ array[0] }}
          </span>
          {{ array[1] }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useEventStore } from 'src/stores/events';
import { computed } from 'vue';

const eventStore = useEventStore();

const props = defineProps({
  id: { type: String, required: true }, // Can be either localId or contentId
});

const completion = computed(() => {
  return eventStore.currentPublishStatus.status.completion;
});

const publishInProgess = computed(() => {
  return eventStore.isPublishActiveByID(props.id);
});

const showPublishSuccessSummary = computed(() => {
  return (
    eventStore.doesPublishStatusApply(props.id)
    &&
    completion.value === 'success'
  );
});

const showPublishError = computed(() => {
  console.log('id: ', props.id);
  console.log('apply?', eventStore.doesPublishStatusApply(props.id));
  console.log('completion.value', completion.value);
  return (
    eventStore.doesPublishStatusApply(props.id)
    &&
    completion.value === 'error'
  );
});

const currentStepInfo = computed(() => {
  const currentStep = eventStore.currentPublishStatus.status.currentStep;
  if (
    !eventStore.doesPublishStatusApply(props.id) ||
    currentStep === undefined
  ) {
    return {
      operation: 'unknown',
      stepStatus: 'unknown',
    };
  }
  const currentStepNumber = eventStore.publishStepOrder[currentStep];
  const numberOfSteps = Object.keys(eventStore.publishStepDisplayNames).length;
  const operation = `${eventStore.publishStepDisplayNames[currentStep]} (${currentStepNumber} of ${numberOfSteps} steps)`;
  let stepStatus;
  const statusList = eventStore.currentPublishStatus.status.steps[currentStep].status;
  if (statusList) {
    const statusMsg = statusList[statusList.length - 1];
    stepStatus = `${statusMsg.message}: ${statusMsg.name}`;
  } else {
    const stepCompletion = eventStore.currentPublishStatus.status.steps[currentStep].completion;
    stepStatus = eventStore.publishStepCompletionStatusNames[stepCompletion];
  }
  return {
    operation,
    stepStatus,
  };
});

</script>
<style scoped lang="scss">
  .q-stepper :deep(.q-stepper__step-inner) {
    padding: unset;
  }
  .q-stepper :deep(.q-stepper__tab) {
    min-height: unset;
    padding: 2px;
  }
  .summary {
    border: solid 1px darkgray;
    padding: 2px;
    max-height: 4.5rem;
    width: 100%;
  }
  .error {
    border: solid 1px darkgray;
    padding: 2px;
    min-height: 4.5rem;
    line-height: 4.5rem;
    width: 100%;
  }
  .hide-overflow {
    overflow: hidden;
  }
</style>
