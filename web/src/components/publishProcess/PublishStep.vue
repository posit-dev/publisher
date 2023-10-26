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
        v-for="(log, index) in logs"
        :key="index"
      >
        <q-item-section>
          <template v-if="isErrorLog(log)">
            <span class="text-red text-weight-medium">{{ log.msg }}</span>
          </template>
          <template v-else>
            {{ log }}
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

type AdvancedLog = {
  msg: string,
  type?: 'error',
}
export type Log = string | AdvancedLog

function isAdvancedLog(log: Log): log is AdvancedLog {
  return !(typeof log === 'string' || log instanceof String);
}
function isErrorLog(log: Log): log is AdvancedLog & { type: 'error' } {
  return isAdvancedLog(log) && log.type === 'error';
}

const colorStore = useColorStore();

const props = defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  logs: { type: Array as PropType<Log[]>, required: false, default: () => [] },
});

const hasError = computed(() => props.logs.some(log => isErrorLog(log)));
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
</style>
