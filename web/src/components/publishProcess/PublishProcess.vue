<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-page
    class="max-width-md q-mx-auto"
    padding
    dark
  >
    <div>
      <q-btn
        :disable="backButtonDisabled"
        color="primary"
        icon="arrow_back"
        label="Back"
        data-automation="BackToConfiguration"
        no-caps
        @click="onBackButton"
      />
    </div>
    <div class="q-mt-lg">
      <h4>Temporary Event Display for Publishing Process</h4>
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

import { EventStream } from 'src/api/resources/EventStream';
import { EventStreamMessage, PublishSuccess } from 'src/api/types/events';
import { PropType, onBeforeUnmount, ref, watch } from 'vue';
import { scroll as qScroll } from 'quasar';
const { getScrollTarget, setVerticalScrollPosition } = qScroll;

const props = defineProps({
  events: {
    type: Array as PropType<EventStreamMessage[]>,
    required: true,
  },
  eventStream: {
    type: Object as PropType<EventStream>,
    required: true,
  }
});

const agentLogEnd = ref<HTMLDivElement | null>(null);

const emit = defineEmits(['back']);

const onBackButton = () => {
  emit('back');
};

const backButtonDisabled = ref(true);

const publishingComplete = (msg: PublishSuccess) => {
  backButtonDisabled.value = false;
  console.log(`msg: ${JSON.stringify(msg)}`);
};
props.eventStream.addEventMonitorCallback('publish/success', publishingComplete);

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
  props.eventStream.delEventFilterCallback(publishingComplete);
});

</script>
