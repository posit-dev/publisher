<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Wrapping Up Deployment"
    icon="checklist"
    :summary="summary"
    :done="done"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import PublishStep from 'src/views/publish-log-view/PublishStep.vue';

import { watch } from 'vue';
import { useEventStore } from 'src/stores/events';

const eventStore = useEventStore();

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['done']);

const done = ref(false);

const summary = computed(() => {
  if (done.value) {
    return `Your project has been successfully published and is 
    available via the Connect Dashboard (${eventStore.currentPublishStatus.status.dashboardURL})
    or directly (${eventStore.currentPublishStatus.status.directURL}).`;
  }
  return `Your project is still being published...`;
});

watch(
  () => eventStore.currentPublishStatus.status.completion,
  (value) => {
    if (value === 'success') {
      done.value = true;
      emit('done');
    }
  },
  {
    immediate: true,
  }
);

</script>

