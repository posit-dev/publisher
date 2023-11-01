<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Upload Bundle"
    icon="login"
    summary="Transferring the files from your local workstation to the server."
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

const startCb = $eventStream.addEventMonitorCallback('publish/uploadBundle/start', (msg) => {
  messages.value.push(msg);
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/uploadBundle/success', (msg) => {
  messages.value.push(msg);
  done.value = true;
  emit('done');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/uploadBundle/failure', (msg) => {
  messages.value.push(msg);
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

