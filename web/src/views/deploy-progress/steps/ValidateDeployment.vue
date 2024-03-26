<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <DeployStep
    :name="name"
    title="Validate Deployment"
    icon="sync"
    :done="done"
    :messages="messages"
  >
    <template #summary>
      Validating your content on the Connect Server
    </template>
  </DeployStep>
</template>

<script setup lang="ts">
import { ref } from "vue";

import DeployStep from "src/views/deploy-progress/DeployStep.vue";

import { watch } from "vue";
import { useEventStore } from "src/stores/events";

const eventStore = useEventStore();

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(["start", "done"]);

const done = ref(false);
const messages = ref(
  eventStore.currentPublishStatus.status.steps.validateDeployment.allMsgs,
);

watch(
  () =>
    eventStore.currentPublishStatus.status.steps.validateDeployment.completion,
  (value) => {
    if (value === "inProgress") {
      emit("start");
    } else if (value === "success") {
      done.value = true;
      emit("done");
    }
  },
  {
    immediate: true,
  },
);
</script>
