<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Create Bundle"
    icon="compress"
    summary="Collecting and bundling up the files included in your project, so that they can be uploaded to the server within a bundle."
    :done="done"
    :messages="messages"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import PublishStep from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';
import { EventStreamMessage } from 'src/api/types/events';

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['start', 'done']);

const $eventStream = useEventStream();

const done = ref(false);
const messages = ref<EventStreamMessage[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/createBundle/start', (msg) => {
  messages.value.push(msg);
  emit('start');
});
const logCb = $eventStream.addEventMonitorCallback('publish/createBundle/log', (msg) => {
  messages.value.push(msg);
});
const successCb = $eventStream.addEventMonitorCallback('publish/createBundle/success', (msg) => {
  messages.value.push(msg);
  done.value = true;
  emit('done');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/createBundle/failure', (msg) => {
  messages.value.push(msg);
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(logCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

