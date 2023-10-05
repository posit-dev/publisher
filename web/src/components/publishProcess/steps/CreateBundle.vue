<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Create Bundle"
    icon="compress"
    summary="Collecting and bundling up the files included in your project, so that they can be uploaded to the server within a bundle."
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

const startCb = $eventStream.addEventMonitorCallback('publish/createBundle/start', (msg) => {
  logs.value.push(JSON.stringify(msg));
});
const successCb = $eventStream.addEventMonitorCallback('publish/createBundle/success', (msg) => {
  logs.value.push(JSON.stringify(msg));
  done.value = true;
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
});
</script>

