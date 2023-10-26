<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Create Deployment"
    icon="create_new_folder"
    summary="Registering the deployment object with the Posit Connect Server."
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

const startCb = $eventStream.addEventMonitorCallback('publish/createDeployment/start', (msg) => {
  messages.value.push(msg.data.message);
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/createDeployment/success', (msg) => {
  messages.value.push(msg.data.message);
  done.value = true;
  emit('done');
});
const errorCb = $eventStream.addEventMonitorCallback('publish/createDeployment/failure', (msg) => {
  messages.value.push({
    msg: msg.data.message,
    type: 'error',
  });
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(errorCb);
});
</script>
