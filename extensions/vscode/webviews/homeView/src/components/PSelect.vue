<template>
  <vscode-dropdown
    :key="renderKey"
    :value="_selection"
    @change="onInnerSelectionChange"
  >
    <vscode-option
      v-for="option in stringifiedOptions"
      :key="option"
      :selected="option === _selection"
      :disabled="disabledSet.has(option)"
      :value="option"
    >
      {{ option }}
    </vscode-option>
  </vscode-dropdown>
</template>

<script setup lang="ts" generic="T">
import { computed, ref, watch } from "vue";

const model = defineModel<T>();

const props = defineProps<{
  options: T[];
  getKey: (o: T) => string;
  disabled?: T[];
}>();

const renderKey = ref(0);

const forceRerender = () => {
  renderKey.value += 1;
};

// Force a re-render when props change to avoid showing incorrect selection
// https://github.com/microsoft/fast/issues/5773
watch(props, forceRerender);

const _selection = computed<string | undefined>(() => {
  return model.value !== undefined ? props.getKey(model.value) : undefined;
});

const onInnerSelectionChange = (event: Event) => {
  const el = event.target as HTMLSelectElement;

  model.value = props.options.find(
    (option) => props.getKey(option) === el.value,
  );
};

const stringifiedOptions = computed((): string[] => {
  return props.options.map((o) => props.getKey(o));
});

const disabledSet = computed((): Set<string> => {
  if (props.disabled) {
    return new Set(props.disabled.map((o) => props.getKey(o)));
  }
  return new Set();
});
</script>
