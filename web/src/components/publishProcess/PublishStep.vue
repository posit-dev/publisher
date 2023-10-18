<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-step
    :name="name"
    title="This is a step"
    :icon="icon"
    :active-icon="icon"
    :header-nav="true"
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
          {{ log }}
        </q-item-section>
      </q-item>
    </q-list>
  </q-step>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';

const colorStore = useColorStore();

defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  logs: { type: Array as PropType<string[]>, required: false, default: () => [] },
});
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
