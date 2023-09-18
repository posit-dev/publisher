// Copyright (C) 2023 by Posit Software, PBC.

import { computed } from 'vue';

// Implemented from: V-Model in Vue3
// https://vanoneang.github.io/article/v-model-in-vue3.html#turn-it-into-a-composable
//
// This technique provides us a way of creating a component which supports multiple
// v-models in its props, but doesn't need to keep implementing the emits, nor the
// typical watches.
//
// See DeploymentMode.vue for example of usage.

export function useModelWrapper(
  props: { modelValue: unknown; },
  emit: (arg0: string, arg1: unknown) => void,
  updateName = 'modelValue',
) {
  return computed({
    get: () => props.modelValue,
    set: (value) => emit(`update:${updateName}`, value)
  });
}
