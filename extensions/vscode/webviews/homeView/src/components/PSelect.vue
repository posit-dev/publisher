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

<script setup lang="ts">
import { computed, ref } from "vue";

export type hasToKey = {
  toKey: () => string;
};

export type SelectOption = string | hasToKey;

const selectOptionToKey = (o: SelectOption): string => {
  switch (typeof o) {
    case "string":
      return o;
    case "object":
      return o.toKey();
  }
};

const model = defineModel<SelectOption>({ required: true });

const props = defineProps<{
  options: SelectOption[];
}>();

const _selection = ref<string>(selectOptionToKey(model.value));

const onInnerSelectionChange = (event: Event) => {
  const el = event.target as HTMLSelectElement;
  _selection.value = el.value;

  model.value =
    props.options.find((option) => selectOptionToKey(option) === el.value) ||
    "";
};

const stringifiedOptions = computed((): string[] => {
  return props.options.map((option) => selectOptionToKey(option));
});
</script>
