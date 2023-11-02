<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Deploy Bundle"
    icon="publish"
    summary="Associating the uploaded bundle with the deployment object."
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

const startCb = $eventStream.addEventMonitorCallback('publish/deployBundle/start', (msg) => {
  messages.value.push(msg);
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/deployBundle/success', (msg) => {
  messages.value.push(msg);
  done.value = true;
  emit('done');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/deployBundle/failure', (msg) => {
  messages.value.push(msg);
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

