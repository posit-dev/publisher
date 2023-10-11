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

import PublishStep from 'src/components/publishProcess/PublishStep.vue';
import { useEventStream } from 'src/plugins/eventStream';

defineProps({
  name: { type: [String, Number], required: true },
});
const emit = defineEmits(['start', 'done']);

const $eventStream = useEventStream();

const done = ref(false);
const messages = ref<string[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/start', (msg) => {
  messages.value.push(msg.data.message);
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/success', (msg) => {
  messages.value.push(msg.data.message);
  done.value = true;
  emit('start');
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
});
</script>

