<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Restore Python Environment"
    icon="move_down"
    summary="Installing the dependent python packages on the server in order to reproduce your runtime environment."
    :done="done"
    :logs="messages"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import PublishStep, { Log } from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['start', 'done']);

const $eventStream = useEventStream();

const done = ref(false);
const messages = ref<Log[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/start', (msg) => {
  messages.value.push(msg.data.message);
  emit('start');
});
const logCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/log', (msg) => {
  messages.value.push(msg.data.message);
});
const progressCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/progress', (msg) => {
  messages.value.push(msg.data.message);
});
const successCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/success', (msg) => {
  messages.value.push(msg.data.message);
  done.value = true;
  emit('start');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/failure', (msg) => {
  messages.value.push({
    msg: msg.data.message,
    type: 'error'
  });
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(logCb);
  $eventStream.delEventFilterCallback(progressCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

