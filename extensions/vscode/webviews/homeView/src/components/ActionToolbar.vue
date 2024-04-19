<template>
  <div class="monaco-action-bar">
    <ul
      class="actions-container"
      role="toolbar"
      :aria-label="`${title} actions`"
    >
      <li
        v-for="action in actions"
        class="action-item menu-entry"
        role="presentation"
      >
        <a
          class="action-label codicon"
          :class="action.codicon"
          role="button"
          :aria-label="action.label"
          tabindex="0"
          @click="action.fn"
          @keydown.enter="action.fn"
        ></a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
export type ActionButton = {
  label: string;
  codicon: string;
  fn: () => void;
};

defineProps<{
  title: string;
  actions?: ActionButton[];
}>();
</script>

<style lang="scss" scoped>
.monaco-action-bar {
  white-space: nowrap;
  height: 100%;

  .actions-container {
    align-items: center;
    display: flex;
    height: 100%;
    margin: 0 auto;
    padding: 0;
    width: 100%;

    .action-item {
      display: block;
      cursor: pointer;
      position: relative;

      .action-label {
        border-radius: 5px;
        padding: 2px;
        font-size: 16px;
        align-items: center;
        display: flex;
        height: 20px;
        width: 20px;
        color: var(--vscode-icon-foreground);

        &:focus {
          opacity: 1;
          outline-color: var(--vscode-focusBorder);
          outline-offset: -1px;
          outline-style: solid;
          outline-width: 1px;
        }

        &:hover {
          background-color: var(--vscode-toolbar-hoverBackground);
          outline: 1px dashed var(--vscode-toolbar-hoverOutline);
          outline-offset: -1px;
        }
      }
    }
  }
}
</style>
