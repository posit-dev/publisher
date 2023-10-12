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
import { onBeforeUnmount, ref } from 'vue';

import PublishStep from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';
import { computed } from 'vue';
import { useDeploymentStore } from 'src/stores/deployment';

const deploymentStore = useDeploymentStore();
const $eventStream = useEventStream();

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['done']);

const dashboardUrl = ref<string | undefined>(undefined);
const directUrl = ref<string | undefined>(undefined);
const done = ref(false);

const summary = computed(() => {
  const destination = deploymentStore.deployment?.target.accountName;
  if (done.value) {
    return `Your project has been successfully published to ${destination} and is available at ${dashboardUrl.value}.`;
  }
  return `Your project is still being published...`;
});

const successCb = $eventStream.addEventMonitorCallback('publish/success', (msg) => {
  dashboardUrl.value = msg.data.dashboardUrl;
  directUrl.value = msg.data.directUrl;
  done.value = true;
  emit('done');
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(successCb);
});
</script>

