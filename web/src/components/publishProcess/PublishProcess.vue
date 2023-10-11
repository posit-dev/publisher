<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-page
    class="max-width-md q-mx-auto"
    padding
  >
    <div>
      <q-btn
        :disable="publishInProgress"
        icon="arrow_back"
        label="Back"
        data-automation="BackToConfiguration"
        no-caps
        @click="onBackButton"
      />
    </div>
    <div class="q-mt-lg">
      <h6 class="q-my-sm">
        {{ progressTitle }}
      </h6>
      <PublishSummary />
      <PublishStepper />
    </div>
  </q-page>
</template>

<script setup lang="ts">

import { PublishSuccess } from 'src/api/types/events';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useEventStream } from 'src/plugins/eventStream';
import PublishStepper from 'src/components/publishProcess/PublishStepper.vue';
import PublishSummary from 'src/components/publishProcess/PublishSummary.vue';
import { useDeploymentStore } from 'src/stores/deployment';

const $eventStream = useEventStream();
const deploymentStore = useDeploymentStore();

const emit = defineEmits(['back']);

const onBackButton = () => {
  emit('back');
};

const publishInProgress = ref(true);

const progressTitle = computed(() => {
  const path = deploymentStore.deployment?.sourcePath;
  const target = deploymentStore.deployment?.target.accountName;
  if (publishInProgress.value) {
    return `Publishing '${path}' to ${target}...`;
  }
  return `'' has been published to ${target}`;
});

const publishingComplete = (msg: PublishSuccess) => {
  publishInProgress.value = false;
  console.log(`msg: ${JSON.stringify(msg)}`);
};
$eventStream.addEventMonitorCallback('publish/success', publishingComplete);

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(publishingComplete);
});

</script>
