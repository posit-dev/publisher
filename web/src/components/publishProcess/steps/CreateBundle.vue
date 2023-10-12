<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Create Bundle"
    icon="compress"
    summary="Collecting and bundling up the files included in your project, so that they can be uploaded to the server within a bundle."
    :done="done"
    :logs="messages"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import PublishStep from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['start', 'done']);

const $eventStream = useEventStream();

const done = ref(false);
const messages = ref<string[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/createBundle/start', (msg) => {
  messages.value.push(msg.data.message);
  emit('start');
});
const logCb = $eventStream.addEventMonitorCallback('publish/createBundle/log', (msg) => {
  messages.value.push(msg.data.message);
});
const successCb = $eventStream.addEventMonitorCallback('publish/createBundle/success', (msg) => {
  messages.value.push(msg.data.message);
  done.value = true;
  emit('done');
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(logCb);
  $eventStream.delEventFilterCallback(successCb);
});
</script>

