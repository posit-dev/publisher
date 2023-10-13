<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row justify-center">
    <div style="width: 60%">
      <q-btn-toggle
        v-model="value"
        no-caps
        unelevated
        size="1rem"
        padding="2px"
        spread
        :options="options"
        :text-color="colorStore.activePallete.deploymentMode.toggle.inActive.text"
        :color="colorStore.activePallete.deploymentMode.toggle.inActive.background"
        :toggle-text-color="colorStore.activePallete.deploymentMode.toggle.active.text"
        :toggle-color="colorStore.activePallete.deploymentMode.toggle.active.background"
        class="toggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';

import { DeploymentModeType } from 'src/api/types/deployments.ts';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';

const colorStore = useColorStore();

const emit = defineEmits(['update:modelValue']);

const props = defineProps({
  modelValue: {
    type: String as PropType<DeploymentModeType>,
    required: true,
  },
});

const options = [
  { label: 'New Deployment', value: <DeploymentModeType>'new' },
  { label: 'Existing Deployment', value: <DeploymentModeType>'update' }
];

const value = computed({
  get() {
    return props.modelValue;
  },
  set(newValue) {
    emit('update:modelValue', newValue);
  }
});

</script>

<style scoped>
.toggle {
  border: 1px solid v-bind('colorToHex(colorStore.activePallete.outline)');
}
</style>
