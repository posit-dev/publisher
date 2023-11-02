<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Restore Python Environment"
    icon="move_down"
    summary="Installing the dependent python packages on the server in order to reproduce your runtime environment."
    :done="done"
    :messages="messages"
    :caption="caption"
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
const caption = ref<string | undefined>();

const startCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/start', (msg) => {
  messages.value.push(msg);
  emit('start');
});
const logCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/log', (msg) => {
  messages.value.push(msg);
});
const statusCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/status', (msg) => {
  let newCaption: string;
  switch (msg.data.status) {
    case 'download+install':
      newCaption = `Downloading and installing package: `;
      break;
    case 'download':
      newCaption = `Downloading package: `;
      break;
    case 'install':
      newCaption = `Installing package: `;
      break;
  }
  newCaption += msg.data.name;
  if (msg.data.version) {
    newCaption += ` (${msg.data.version})`;
  }
  caption.value = newCaption;
});
const successCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/success', (msg) => {
  messages.value.push(msg);
  caption.value = undefined;
  done.value = true;
  emit('start');
});
const failureCb = $eventStream.addEventMonitorCallback('publish/restorePythonEnv/failure', (msg) => {
  messages.value.push(msg);
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(logCb);
  $eventStream.delEventFilterCallback(statusCb);
  $eventStream.delEventFilterCallback(successCb);
  $eventStream.delEventFilterCallback(failureCb);
});
</script>

