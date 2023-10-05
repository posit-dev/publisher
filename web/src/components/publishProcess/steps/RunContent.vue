<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Run Content"
    icon="sync"
    summary="Performing execution checks ahead of applying settings."
    :done="done"
    :logs="logs"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import PublishStep from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';

defineProps({
  name: { type: [String, Number], required: true },
});

const $eventStream = useEventStream();

const done = ref(false);
const logs = ref<string[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/runContent/start', (msg) => {
  logs.value.push(JSON.stringify(msg));
});
const successCb = $eventStream.addEventMonitorCallback('publish/runContent/success', (msg) => {
  logs.value.push(JSON.stringify(msg));
  done.value = true;
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
});
</script>

