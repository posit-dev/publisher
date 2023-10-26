<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Deploy Bundle"
    icon="publish"
    summary="Associating the uploaded bundle with the deployment object."
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

const startCb = $eventStream.addEventMonitorCallback('publish/deployBundle/start', (msg) => {
  messages.value.push(msg.data.message);
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/deployBundle/success', (msg) => {
  messages.value.push(msg.data.message);
  done.value = true;
  emit('done');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/deployBundle/failure', (msg) => {
  messages.value.push({
    msg: msg.data.message,
    type: 'error'
  });
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

