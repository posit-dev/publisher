<template>
  <input
    v-model="model"
    ref="input"
    class="sidebar-input"
    :aria-label="ariaLabel"
    @keydown.prevent.enter="$emit('submit')"
    @keydown.escape="$emit('cancel')"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
const model = defineModel();

const props = defineProps<{
  label: string;
}>();

defineEmits(["submit", "cancel"]);

const input = ref<HTMLInputElement | null>(null);

const ariaLabel = computed(
  () => `${props.label}. Press Enter to confirm or Escape to cancel.`,
);

const select = () => {
  input.value?.select();
};

defineExpose({ select });
</script>

<style lang="scss" scoped>
.sidebar-input {
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
