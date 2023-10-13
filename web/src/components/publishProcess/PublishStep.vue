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
      class="text-bold q-pa-sm"
      :style="summaryStyle"
    >
      {{ summary }}
    </div>
    <q-list
      dense
      :style="logStyle"
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
import { computed } from 'vue';

const colorStore = useColorStore();

defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  logs: { type: Array as PropType<string[]>, required: false, default: () => [] },
});

const summaryStyle = computed(() => {
  return `
    color: ${colorToHex(colorStore.activePallete.progress.summary.text)};
    background-color: ${colorToHex(colorStore.activePallete.progress.summary.background)};
    border: solid ${colorToHex(colorStore.activePallete.progress.summary.border)} 1px;
  `;
});
const logStyle = computed(() => {
  return `
    color: ${colorToHex(colorStore.activePallete.progress.log.text)};
    background-color: ${colorToHex(colorStore.activePallete.progress.log.background)};
    border: solid ${colorToHex(colorStore.activePallete.progress.summary.border)} 1px;
  `;
});
</script>

