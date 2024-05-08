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
          :title="action.label"
          :aria-label="action.label"
          tabindex="0"
          @click.stop="action.fn"
          @keydown.enter="action.fn"
        ></a>
      </li>

      <li
        v-if="contextMenu"
        ref="contextMenuButton"
        :data-vscode-context="`{&quot;webviewSection&quot;: &quot;${contextMenu}&quot;, &quot;preventDefaultContextMenuItems&quot;: true}`"
        class="action-item menu-entry"
        role="presentation"
      >
        <a
          class="action-label codicon codicon-ellipsis"
          role="button"
          :title="`More ${title} actions`"
          :aria-label="`More ${title} actions`"
          tabindex="0"
          @click.stop.prevent="openContextMenu"
          @keydown.enter="openContextMenu"
        >
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

export type ActionButton = {
  label: string;
  codicon: string;
  fn: () => void;
};

defineProps<{
  title: string;
  actions?: ActionButton[];
  contextMenu?: string;
}>();

const contextMenuButton = ref<HTMLAnchorElement | null>(null);

const openContextMenu = (e: Event) => {
  if (e instanceof PointerEvent) {
    e.target?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: e.clientX,
        clientY: e.clientY,
      }),
    );
  } else if (e instanceof KeyboardEvent) {
    e.target?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: contextMenuButton.value?.getBoundingClientRect().x,
        clientY: contextMenuButton.value?.getBoundingClientRect().bottom,
      }),
    );
  }
};
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
