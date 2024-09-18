<template>
  <form v-if="showInput" @submit.prevent="updateSecret">
    <input
      ref="input"
      class="secret-input"
      v-model="inputValue"
      aria-label="Type secret value. Press Enter to confirm or Escape to cancel."
      @keydown.escape="showInput = false"
    />
  </form>
  <TreeItem
    v-else
    :title="name"
    :description="secretValue ? '••••••' : undefined"
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
}

const props = defineProps<Props>();

const input = ref<HTMLInputElement | null>(null);
const showInput = ref(false);
const inputValue = ref<string>();

const home = useHomeStore();

const secretValue = computed(() => home.secrets.get(props.name));

const inputSecret = () => {
  // Update inputValue in case the secret value has changed or been cleared
  inputValue.value = secretValue.value;
  showInput.value = true;
  // Wait for next tick to ensure the input is rendered
  nextTick(() => input.value?.select());
};

const updateSecret = () => {
  home.secrets.set(props.name, inputValue.value);
  showInput.value = false;
};

const tooltip = computed(() => {
  if (secretValue.value) {
    return "On the next deploy the new value will be set for the deployment.";
  }

  return "No value has been set. The value will not change on the next deploy.";
});

const actions = computed<ActionButton[]>(() => {
  const result = [];

  if (secretValue.value) {
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

<style lang="scss" scoped>
.secret-input {
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, transparent);
  color: var(--vscode-input-foreground);
  line-height: 20px;
  padding: 0;
  outline-color: var(--vscode-focusBorder);
  outline-offset: -1px;
  outline-style: solid;
  outline-width: 1px;
}
</style>
