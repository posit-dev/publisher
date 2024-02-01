<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <DeployStep
    :name="name"
    title="Wrapping Up Deployment"
    icon="checklist"
    :done="done"
  >
    <template #summary>
      <template v-if="done">
        <template v-if="eventStore.currentPublishStatus.status.completion === 'success'">
          Your project has been successfully deployed and is
          available via the
          <a
            :href="eventStore.currentPublishStatus.status.dashboardURL"
            target="_blank"
            rel="noopener noreferrer"
          >Connect Dashboard</a>
          or
          <a
            :href="eventStore.currentPublishStatus.status.directURL"
            target="_blank"
            rel="noopener noreferrer"
          >directly</a>.
        </template>
        <template v-if="eventStore.currentPublishStatus.status.completion === 'error'">
          Your project has encountered an error while being deployed.
          To diagnose it further, you can access it via the
          <a
            :href="eventStore.currentPublishStatus.status.dashboardURL"
            target="_blank"
            rel="noopener noreferrer"
          >Connect Dashboard</a>
        </template>
      </template>
      <template v-else>
        Your project is still being deployed...
      </template>
    </template>
  </DeployStep>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import DeployStep from 'src/views/deploy-progress/DeployStep.vue';

import { watch } from 'vue';
import { useEventStore } from 'src/stores/events';

const eventStore = useEventStore();

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['done']);

const done = ref(false);

watch(
  () => eventStore.currentPublishStatus.status.completion,
  (value) => {
    if (value === 'success' || value === 'error') {
      done.value = true;
      emit('done');
    }
  },
  {
    immediate: true,
  }
);

</script>

