<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    style="min-width:100%; min-height: 5rem;"
  >
    <div
      v-if="showOtherPublishOperationInProgress"
      class="summary row items-center"
      :class="textClass"
    >
      <div class="col q-ml-sm">
        <q-spinner-grid
          color="primary"
          size="2rem"
        />
      </div>
      <div class="col-10 text-left">
        <div class="text-bold">
          Your project is being published to another destination.
        </div>
        <div>
          Please wait until that operation is complete.
        </div>
      </div>
    </div>
    <div
      v-if="showPublishInProgress"
      class="summary row items-center"
      :class="textClass"
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
          {{ eventStore.summaryOfCurrentPublishingProcess.operation }}
        </div>
        <div class="text-caption">
          {{ eventStore.summaryOfCurrentPublishingProcess.stepStatus }}
        </div>
      </div>
    </div>
    <div
      v-if="showPublishSuccessSummary"
      class="summary row text-left items-center"
      :class="textClass"
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
      class="error row text-left items-center"
      :class="textClass"
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
          v-for="keyValuePair in eventStore.currentPublishStatus.status.error"
          :key="keyValuePair.key"
        >
          <span class="text-bold">
            {{ keyValuePair.key }}
          </span>
          {{ keyValuePair.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useEventStore } from 'src/stores/events';
import { computed } from 'vue';
import { useQuasar } from 'quasar';

const eventStore = useEventStore();
const $q = useQuasar();

const props = defineProps({
  id: { type: String, required: true }, // Can be either localId or contentId
});

const completion = computed(() => {
  return eventStore.currentPublishStatus.status.completion;
});

const showOtherPublishOperationInProgress = computed(() => {
  return (
    eventStore.publishInProgess &&
    !eventStore.doesPublishStatusApply(props.id)
  );
});

const showPublishInProgress = computed(() => {
  return (
    eventStore.isPublishActiveByID(props.id) &&
    eventStore.currentPublishStatus.status.currentStep // Make sure it has started
  );
});

const showPublishSuccessSummary = computed(() => {
  return (
    eventStore.doesPublishStatusApply(props.id)
    &&
    completion.value === 'success'
  );
});

const showPublishError = computed(() => {
  return (
    eventStore.doesPublishStatusApply(props.id)
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
</style>
