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
      <div
        v-for="(eventItem, index) in events"
        :key="index"
      >
        {{ JSON.stringify(eventItem) }}
      </div>
      <p ref="agentLogEnd">
        &nbsp;
      </p>
    </div>
  </q-page>
</template>

<script setup lang="ts">

import { EventStreamMessage, PublishSuccess } from 'src/api/types/events';
import { computed, PropType, onBeforeUnmount, ref, watch } from 'vue';
import { scroll as qScroll } from 'quasar';
import { useEventStream } from 'src/plugins/eventStream';
import PublishStepper from 'src/components/publishProcess/PublishStepper.vue';
import PublishSummary from 'src/components/publishProcess/PublishSummary.vue';
import { useDeploymentStore } from 'src/stores/deployment';

const { getScrollTarget, setVerticalScrollPosition } = qScroll;

const props = defineProps({
  events: {
    type: Array as PropType<EventStreamMessage[]>,
    required: true,
  }
});

const $eventStream = useEventStream();
const deploymentStore = useDeploymentStore();
const agentLogEnd = ref<HTMLDivElement | null>(null);

const emit = defineEmits(['back']);

const onBackButton = () => {
  emit('back');
};

const publishInProgress = ref(true);

const progressTitle = computed(() => {
  const name = deploymentStore.deployment?.sourcePath;
  const target = deploymentStore.deployment?.target.accountName;
  if (publishInProgress.value) {
    return `Publishing '${name}' to ${target}...`;
  }
  return `'' has been published to ${target}`;
});

const publishingComplete = (msg: PublishSuccess) => {
  publishInProgress.value = false;
  console.log(`msg: ${JSON.stringify(msg)}`);
};
$eventStream.addEventMonitorCallback('publish/success', publishingComplete);

watch(props.events, () => {
  if (agentLogEnd.value) {
    const el = agentLogEnd.value as HTMLDivElement;
    const target = getScrollTarget(el);
    const offset = el.offsetTop;
    const duration = 1000;
    setVerticalScrollPosition(target, offset, duration);
  }
});

onBeforeUnmount(() => {
  $eventStream.delEventFilterCallback(publishingComplete);
});

</script>
