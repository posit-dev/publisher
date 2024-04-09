<template>
  <vscode-dropdown :value="_selection" @change="onInnerSelectionChange">
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
import { computed } from "vue";

const model = defineModel<T>();

const props = defineProps<{
  options: T[];
  getKey: (o: T) => string;
  disabled?: T[];
}>();

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
