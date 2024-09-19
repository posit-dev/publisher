<template>
  <SidebarInput
    v-if="showInput"
    ref="input"
    v-model="inputValue"
    label="Type secret value"
    @submit="updateSecret"
    @cancel="showInput = false"
  />
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
import SidebarInput from "src/components/SidebarInput.vue";
import { useHomeStore } from "src/stores/home";
import { ActionButton } from "src/components/ActionToolbar.vue";

interface Props {
  name: string;
}

const props = defineProps<Props>();

const input = ref<InstanceType<typeof SidebarInput> | null>(null);
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
