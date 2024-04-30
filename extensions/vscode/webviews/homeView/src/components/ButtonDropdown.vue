<template>
  <div class="button-dropdown">
    <vscode-button
      v-bind="$attrs"
      @click="emit('click')"
      class="primary-button"
    >
      <slot />
    </vscode-button>
    <div class="dropdown-separator">
      <div class="separator-line" />
    </div>
    <vscode-button
      :title="dropdownLabel"
      :aria-label="dropdownLabel"
      class="dropdown-button"
      @click="emit('dropdownClick')"
    >
      <span class="codicon" :class="dropdownCodicon" />
    </vscode-button>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

const emit = defineEmits(["click", "dropdownClick"]);

interface Props {
  dropdownCodicon?: string;
  dropdownLabel: string;
}

withDefaults(defineProps<Props>(), {
  dropdownCodicon: "codicon-chevron-down",
});
</script>

<style lang="scss" scoped>
.button-dropdown {
  display: flex;

  .primary-button {
    border-right-width: 0 !important;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .dropdown-separator {
    border-top: 1px solid var(--vscode-button-border);
    border-bottom: 1px solid var(--vscode-button-border);
    background-color: var(--vscode-button-background);
    cursor: default;
    padding: 4px 0;

    .separator-line {
      background-color: var(--vscode-button-separator);
      height: 100%;
      width: 1px;
    }
  }

  .dropdown-button {
    border-left-width: 0 !important;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;

    &::part(control) {
      padding: 0 4px;
    }
  }
}
</style>
