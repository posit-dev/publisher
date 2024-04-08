<template>
  <vscode-dropdown :value="_selection" @change="onInnerSelectionChange">
    <vscode-option
      v-for="option in stringifiedOptions"
      :key="option"
      :selected="option === _selection"
      :value="option"
    >
      {{ option }}
    </vscode-option>
  </vscode-dropdown>
</template>

<script setup lang="ts" generic="T">
import { computed, ref } from "vue";

const model = defineModel<T>();

const props = defineProps<{
  options: T[];
  getKey: (o: T) => string;
}>();

const _selection = ref<string | undefined>(
  model.value !== undefined ? props.getKey(model.value) : undefined,
);

const onInnerSelectionChange = (event: Event) => {
  const el = event.target as HTMLSelectElement;
  _selection.value = el.value;

  model.value = props.options.find(
    (option) => props.getKey(option) === el.value,
  );
};

const stringifiedOptions = computed((): string[] => {
  return props.options.map((option) => props.getKey(option));
});
</script>
