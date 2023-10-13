<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item
    :default-opened="defaultOpen"
    :expand-icon="expandIcon"
    :group="group"
    :header-class="headerClass"
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
        <q-item-label>
          {{ title }}
        </q-item-label>
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

    <q-card class="panel-card">
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

const headerClass = computed(() => {
  return isOpen.value
    ? 'panel-header header-open-border-bottom'
    : 'panel-header header-closed-border-bottom';
});

const headerBackgroundColor = computed(() => {
  return isOpen.value
    ? `${colorToHex(colorStore.activePallete.expansion.header.open.background)}`
    : `${colorToHex(colorStore.activePallete.expansion.header.closed.background)}`;
});

const headerTextColor = computed(() => {
  return isOpen.value
    ? `${colorToHex(colorStore.activePallete.expansion.header.open.text)}`
    : `${colorToHex(colorStore.activePallete.expansion.header.closed.text)}`;
});

</script>

<style>
.panel-header {
  border-left: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  border-top: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  border-right: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  background-color: v-bind('headerBackgroundColor') !important;
  color: v-bind('headerTextColor') !important;
}

.header-closed-border-bottom {
  border-bottom: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
}

.header-open-border-bottom {
  border-bottom: none !important;
}

.panel-card {
  border-left: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  border-top: none !important;
  border-right: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  border-bottom: solid 1px v-bind('colorToHex(colorStore.activePallete.outline)') !important;
  background-color: v-bind('colorToHex(colorStore.activePallete.expansion.card.background)') !important;
  color: v-bind('colorToHex(colorStore.activePallete.expansion.card.text)') !important;
}
</style>
