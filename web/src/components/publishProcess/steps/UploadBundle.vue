<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Upload Bundle"
    icon="login"
    summary="Transferring the files from your local workstation to the server."
    :done="done"
    :logs="logs"
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
const logs = ref<string[]>([]);

const startCb = $eventStream.addEventMonitorCallback('publish/uploadBundle/start', (msg) => {
  logs.value.push(JSON.stringify(msg));
  emit('start');
});
const successCb = $eventStream.addEventMonitorCallback('publish/uploadBundle/success', (msg) => {
  logs.value.push(JSON.stringify(msg));
  done.value = true;
  emit('done');
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(startCb);
  $eventStream.delEventFilterCallback(successCb);
});
</script>

