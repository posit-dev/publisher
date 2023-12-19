<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    style="min-width:100%; min-height: 5rem;"
  >
    <div
      v-if="showOtherDeployOperationInProgress"
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
          Your project is already being deployed to another deployment.
        </div>
        <div>
          Please wait until that operation is complete.
        </div>
      </div>
    </div>
    <div
      v-if="showDeployInProgress"
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
          Deploying project...
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
      v-if="showDeploySuccessSummary"
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
          {{ pastTenseModifier }} Deploy was successful!
        </div>
        <div>
          Access through Dashboard:
          <span>
            {{ eventStore.currentPublishStatus.status.dashboardURL }}
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="showDeployError"
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
          {{ pastTenseModifier }} Deploying Operation has failed.
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
  currentTense: { type: Boolean, required: true },
});

const completion = computed(() => {
  return eventStore.currentPublishStatus.status.completion;
});

const showOtherDeployOperationInProgress = computed(() => {
  return (
    eventStore.publishInProgess &&
    !eventStore.doesPublishStatusApply(props.id)
  );
});

const showDeployInProgress = computed(() => {
  return (
    eventStore.isPublishActiveByID(props.id) &&
    eventStore.currentPublishStatus.status.currentStep // Make sure it has started
  );
});

const showDeploySuccessSummary = computed(() => {
  return (
    eventStore.doesPublishStatusApply(props.id)
    &&
    completion.value === 'success'
  );
});

const showDeployError = computed(() => {
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

const pastTenseModifier = computed((): string => {
  if (!props.currentTense) {
    return 'Previous ';
  }
  return '';
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
