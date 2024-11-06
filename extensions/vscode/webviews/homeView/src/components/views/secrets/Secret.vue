<template>
  <TreeItem
    :title="name"
    :actions="actions"
    :codicon="
      needsValue
        ? 'codicon-warning'
        : secretValue
          ? 'codicon-cloud-upload'
          : 'codicon-check'
    "
    :list-style="
      needsValue || secretValue || isEditing ? 'default' : 'deemphasized'
    "
    :tooltip="tooltip"
    align-icon-with-twisty
    :data-vscode-context="vscodeContext"
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
      <template v-else-if="!needsValue">••••••</template>
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

const onServer = computed(() => home.serverSecrets.has(props.name));

const needsValue = computed(() => !secretValue.value && !onServer.value);

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
  if (onServer.value) {
    if (secretValue.value) {
      return "On the next deploy the secret will be overwritten with the new value.";
    } else {
      return "The value is set on the server. Set a new value to overwrite it on the next deploy.";
    }
  } else {
    if (secretValue.value) {
      return "On the next deploy the secret will be set.";
    } else {
      return "The secret will not be created on the next deploy without a value. Set a value to set it.";
    }
  }
});

const actions = computed<ActionButton[]>(() => {
  // Show no actions while the value is being edited
  if (isEditing.value) {
    return [];
  }

  const result = [
    {
      label: "Edit Value",
      codicon: "codicon-symbol-string",
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

const vscodeContext = computed(() => {
  return JSON.stringify({
    name: props.name,
    webviewSection: "secrets-tree-item",
    preventDefaultContextMenuItems: true,
  });
});
</script>
