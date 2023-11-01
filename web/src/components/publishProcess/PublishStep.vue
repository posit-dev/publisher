<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-step
    :name="name"
    title="This is a step"
    :icon="icon"
    :active-icon="hasError ? 'warning' : icon"
    :active-color="hasError ? 'red' : undefined"
    :header-nav="true"
    :error="hasError"
    error-icon="warning"
    error-color="red"
  >
    <div
      class="text-bold q-pa-sm summaryClass"
    >
      {{ summary }}
    </div>
    <q-list
      dense
      class="logClass"
    >
      <q-item
        v-for="(msg, index) in messages"
        :key="index"
      >
        <q-item-section>
          <template v-if="isErrorEventStreamMessage(msg)">
            <span class="text-error text-weight-medium">{{ msg.data.message }}</span>
          </template>
          <template v-else>
            {{ msg.data.message }}
          </template>
        </q-item-section>
      </q-item>
    </q-list>
  </q-step>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';
import { EventStreamMessage, isErrorEventStreamMessage } from 'src/api/types/events';

const colorStore = useColorStore();

const props = defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  messages: { type: Array as PropType<EventStreamMessage[]>, required: false, default: () => [] },
});

const hasError = computed(() => props.messages.some(msg => isErrorEventStreamMessage(msg)));
</script>

<style scoped>

.summaryClass {
  color: v-bind('colorToHex(colorStore.activePallete.progress.summary.text)');
  background-color: v-bind('colorToHex(colorStore.activePallete.progress.summary.background)');
  border: solid v-bind('colorToHex(colorStore.activePallete.progress.summary.border)') 1px;
}

.logClass {
  color: v-bind('colorToHex(colorStore.activePallete.progress.log.text)');
  background-color: v-bind('colorToHex(colorStore.activePallete.progress.log.background)');
  border: solid v-bind('colorToHex(colorStore.activePallete.progress.summary.border)') 1px;
}

.text-error {
  color: v-bind('colorToHex(colorStore.activePallete.textError)')
}
</style>
