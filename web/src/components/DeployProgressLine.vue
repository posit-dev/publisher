<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    v-if="publishInProgess"
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
    v-if="showPublishError"
    class="flex items-center"
    :class="textClass"
  >
    <q-icon
      name="error"
      size="1rem"
    />
    <div class="q-ml-sm text-left text-bold">
      Publishing Operation has failed.
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

const publishInProgess = computed(() => {
  return eventStore.isPublishActiveByID(props.id);
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
