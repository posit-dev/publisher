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

const startCb = $eventStream.addEventMonitorCallback('publish/runContent/start', (msg) => {
  messages.value.push(msg);
  emit('start');
});
const logCb = $eventStream.addEventMonitorCallback('publish/runContent/log', (msg) => {
  messages.value.push(msg);
});
const successCb = $eventStream.addEventMonitorCallback('publish/runContent/success', (msg) => {
  messages.value.push(msg);
  done.value = true;
  emit('done');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/runContent/failure', (msg) => {
  messages.value.push(msg);
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(logCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

