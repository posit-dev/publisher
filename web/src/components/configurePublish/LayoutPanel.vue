<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item
    :default-opened="defaultOpen"
    :expand-icon="expandIcon"
    header-class="q-px-none"
    :style="headerStyle"
    :group="group"
    @before-show="onBeforeShow"
    @before-hide="onBeforeHide"
  >
    <template #header>
      <q-item-section
        avatar
        class="q-ml-sm"
      >
        <slot name="avatar" />
      </q-item-section>

      <q-item-section>
        <q-item-label>{{ title }}</q-item-label>
        <q-item-label
          v-if="subtitle"
          caption
        >
          {{ subtitle }}
        </q-item-label>
        <q-tooltip
          v-if="tooltip"
          anchor="top middle"
        >
          {{ tooltip }}
        </q-tooltip>
      </q-item-section>
    </template>

    <q-card
      :style="cardStyle"
    >
      <q-card-section>
        <slot />
        <!-- TODO: select from previous deployments or add to existing or new targets -->
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useColorStore } from 'src/stores/color';

const colorStore = useColorStore();

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: false, default: undefined },
  tooltip: { type: String, required: false, default: undefined },
  defaultOpen: { type: Boolean, required: false, default: false },
  expandIcon: { type: String, required: false, default: undefined },
  group: { type: String, required: false, default: undefined },
});

const isOpen = ref(props.defaultOpen);

const onBeforeShow = () => {
  isOpen.value = true;
};
const onBeforeHide = () => {
  isOpen.value = false;
};

const headerStyle = computed(() : string => {
  const bg = isOpen.value ?
    `${colorStore.activePallete.expansion.header.open.background}` :
    `${colorStore.activePallete.expansion.header.closed.background}`;
  const text = isOpen.value ?
    `${colorStore.activePallete.expansion.header.open.text}` :
    `${colorStore.activePallete.expansion.header.closed.text}`;

  return `
    background-color: ${bg};
    color: ${text};
  `;
});
const cardStyle = computed(() : string => {
  return `
    background-color: ${colorStore.activePallete.expansion.card.background};
    color: ${colorStore.activePallete.expansion.card.text};
  `;
});
</script>
