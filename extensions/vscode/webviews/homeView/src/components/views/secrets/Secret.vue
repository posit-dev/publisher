<template>
  <form v-if="showInput" @submit.prevent="updateSecret">
    <input
      ref="input"
      v-model="inputValue"
      aria-label="Type secret value. Press Enter to confirm or Escape to cancel."
      @keydown.escape="showInput = false"
    />
  </form>
  <TreeItem
    v-else
    :title="name"
    :description="value ? '••••••' : undefined"
    :actions="actions"
    codicon="codicon-lock-small"
    :tooltip="tooltip"
    align-icon-with-twisty
    @click="inputSecret"
  />
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";

import TreeItem from "src/components/tree/TreeItem.vue";
import { useHomeStore } from "src/stores/home";
import { ActionButton } from "src/components/ActionToolbar.vue";

interface Props {
  name: string;
  value?: string;
}

const props = defineProps<Props>();

const input = ref<HTMLInputElement | null>(null);
const showInput = ref(false);
const inputValue = ref(props.value);

const home = useHomeStore();

const inputSecret = () => {
  showInput.value = true;
  nextTick(() => input.value?.select());
};

const updateSecret = () => {
  home.secrets.set(props.name, inputValue.value);
  showInput.value = false;
};

const tooltip = computed(() => {
  if (props.value) {
    return "On the next deploy the new value will be set for the deployment.";
  }

  return "No value has been set. The value will not change on the next deploy.";
});

const actions = computed<ActionButton[]>(() => {
  const result = [];

  if (props.value) {
    result.push({
      label: "Clear Value",
      codicon: "codicon-x",
      fn: () => {
        home.secrets.set(props.name, undefined);
      },
    });
  }

  return result;
});
</script>
