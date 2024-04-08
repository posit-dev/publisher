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

const model = defineModel<string>({ required: true });

const props = defineProps<{
  options: string[];
}>();

const _selection = ref<string>(model.value);

const onInnerSelectionChange = (event: Event) => {
  const el = event.target as HTMLSelectElement;
  _selection.value = el.value;

  model.value = props.options.find((option) => option === el.value) || "";
};

const stringifiedOptions = computed(() => {
  return props.options.map((option) => option);
});
</script>
