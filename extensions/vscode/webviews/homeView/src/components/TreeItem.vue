<template>
  <div
    class="tree-item"
    :class="{
      'align-icon-with-twisty': alignIconWithTwisty,
      collapsible: $slots.default,
    }"
  >
    <div
      class="tree-item-container"
      v-on="{
        click: $slots.default ? toggleExpanded : undefined,
      }"
    >
      <div
        v-if="$slots.default"
        class="twisty-container codicon"
        :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
      />
      <div v-if="codicon" class="tree-item-icon codicon" :class="codicon" />
      <div class="tree-item-label-container">
        <span class="tree-item-title">{{ title }}</span>
        <span v-if="description" class="tree-item-description">
          {{ description }}
        </span>
      </div>
      <div v-if="actions" class="actions">
        <ActionToolbar :title="title" :actions="actions" />
      </div>
      <div v-if="$slots.postDecor">
        <slot name="postDecor" />
      </div>
    </div>

    <div v-if="$slots.default && expanded" class="tree-item-children">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToolbar, { ActionButton } from "./ActionToolbar.vue";

const expanded = defineModel("expanded", { required: false, default: false });

defineProps<{
  title: string;
  description?: string;
  alignIconWithTwisty?: boolean;
  codicon?: string;
  actions?: ActionButton[];
}>();

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};
</script>

<style lang="scss" scoped>
.tree-item {
  color: var(--vscode-foreground);

  &.collapsible .tree-item-container,
  &.align-icon-with-twisty .tree-item-container {
    padding-left: 8px;
  }

  .tree-item-container {
    display: flex;
    align-items: center;
    overflow: hidden;
    padding-left: 16px;
    padding-right: 12px;
    cursor: pointer;
    touch-action: none;
    user-select: none;

    .twisty-container {
      display: flex;
      line-height: 22px;
      align-items: center;
      flex-shrink: 0;
      justify-content: center;
      font-size: 16px;
      padding-right: 6px;
      width: 22px;
      color: var(--vscode-icon-foreground);
    }

    .tree-item-icon {
      color: var(--vscode-icon-foreground);
      align-items: center;
      background-position: 0;
      background-repeat: no-repeat;
      background-size: 16px;
      display: flex;
      height: 22px;
      width: 22px;
      justify-content: center;
      padding-right: 6px;
      -webkit-font-smoothing: antialiased;
    }

    .tree-item-label-container {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;

      .tree-item-title {
        line-height: 22px;
        color: inherit;
        white-space: pre;
      }

      .tree-item-description {
        line-height: 22px;
        font-size: 0.9em;
        margin-left: 0.5em;
        opacity: 0.7;
        white-space: pre;
      }
    }

    .actions {
      display: none;
      max-width: fit-content;
      flex-grow: 100;
    }

    &:hover {
      color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
      background-color: var(--vscode-list-hoverBackground);

      .tree-item-title {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
      }

      .tree-item-description {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
      }
    }

    &:hover .actions,
    &:focus-within .actions {
      display: initial;
    }
  }
}
</style>
