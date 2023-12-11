<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Run Content"
    icon="sync"
    summary="Performing execution checks ahead of applying settings."
    :done="done"
    :messages="messages"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

import PublishStep from 'src/views/publish-progress/PublishStep.vue';

import { watch } from 'vue';
import { useEventStore } from 'src/stores/events';

const eventStore = useEventStore();

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['start', 'done']);

const done = ref(false);
const messages = ref(eventStore.currentPublishStatus.status.steps.runContent.allMsgs);

watch(
  () => eventStore.currentPublishStatus.status.steps.runContent.completion,
  (value) => {
    if (value === 'inProgress') {
      emit('start');
    } else if (value === 'success') {
      done.value = true;
      emit('done');
    }
  },
  {
    immediate: true,
  }
);
</script>

