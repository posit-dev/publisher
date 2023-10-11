<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item
    :default-opened="defaultOpen"
    :expand-icon="expandIcon"
    :header-style="headerStyle"
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
import { colorToHex } from 'src/utils/colorValues';

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

const headerStyle = computed(() : string[] => {
  const styles = [
    `border-left: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;`,
    `border-top: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;`,
    `border-right: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;`,
  ];
  if (isOpen.value) {
    styles.push(`border-bottom: none !important;`);
  } else {
    styles.push(`border-bottom: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;`);
  }

  const bg = isOpen.value ?
    `${colorToHex(colorStore.activePallete.expansion.header.open.background)}` :
    `${colorToHex(colorStore.activePallete.expansion.header.closed.background)}`;
  styles.push(`background-color: ${bg} !important;`);

  const text = isOpen.value ?
    `${colorToHex(colorStore.activePallete.expansion.header.open.text)}` :
    `${colorToHex(colorStore.activePallete.expansion.header.closed.text)}`;
  styles.push(`color: ${text} !important;`);
  return styles;
});

const cardStyle = computed(() : string => {
  const result = (`
    border-left: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;
    border-top: none !important;
    border-right: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;
    border-bottom: solid 1px ${colorToHex(colorStore.activePallete.outline)} !important;
    background-color: ${colorToHex(colorStore.activePallete.expansion.card.background)} !important;
    color: ${colorToHex(colorStore.activePallete.expansion.card.text)} !important;
  `);
  console.log(`cardStyle = ${result}`);
  return result;
});
</script>
