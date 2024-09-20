<template>
  <TreeItem
    :title="name"
    :actions="actions"
    codicon="codicon-lock-small"
    :list-style="secretValue || isEditing ? 'default' : 'deemphasized'"
    :tooltip="tooltip"
    align-icon-with-twisty
  >
    <template #description>
      <SidebarInput
        v-if="isEditing"
        ref="input"
        v-model="inputValue"
        class="w-full"
        label="Type secret value"
        @submit="updateSecret"
        @cancel="isEditing = false"
      />
      <template v-else-if="secretValue">••••••</template>
    </template>
  </TreeItem>
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
const isEditing = ref(false);
const inputValue = ref<string>();

const home = useHomeStore();

const secretValue = computed(() => home.secrets.get(props.name));

const inputSecret = () => {
  // Update inputValue in case the secret value has changed or been cleared
  inputValue.value = secretValue.value;
  isEditing.value = true;
  // Wait for next tick to ensure the input is rendered
  nextTick(() => input.value?.select());
};

const updateSecret = () => {
  home.secrets.set(props.name, inputValue.value);
  isEditing.value = false;
};

const tooltip = computed(() => {
  if (secretValue.value) {
    return "On the next deploy the new value will be set for the deployment.";
  }

  return "No value has been set. The value will not change on the next deploy.";
});

const actions = computed<ActionButton[]>(() => {
  // Show no actions while the value is being edited
  if (isEditing.value) {
    return [];
  }

  const result = [
    {
      label: "Edit Value",
      codicon: "codicon-pencil",
      fn: inputSecret,
    },
  ];

  if (secretValue.value) {
    result.push({
      label: "Clear Value",
      codicon: "codicon-remove",
      fn: () => {
        home.secrets.set(props.name, undefined);
      },
    });
  }

  return result;
});
</script>
