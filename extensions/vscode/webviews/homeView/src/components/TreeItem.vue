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
      :title="tooltip"
      v-on="{
        click: $slots.default ? toggleExpanded : undefined,
      }"
    >
      <div class="indent">
        <div v-for="_ in indentLevel - 1" class="indent-guide"></div>
      </div>
      <div
        class="twisty-container"
        :class="[
          { codicon: $slots.default },
          $slots.default
            ? expanded
              ? 'codicon-chevron-down'
              : 'codicon-chevron-right'
            : undefined,
        ]"
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

    <div v-show="$slots.default && expanded" class="tree-item-children">
      <slot :indent-level="indentLevel + 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToolbar, { ActionButton } from "src/components/ActionToolbar.vue";

const expanded = defineModel("expanded", { required: false, default: false });

interface Props {
  title: string;
  description?: string;
  tooltip?: string;
  alignIconWithTwisty?: boolean;
  codicon?: string;
  actions?: ActionButton[];
  indentLevel?: number;
}

withDefaults(defineProps<Props>(), {
  indentLevel: 1,
});

defineSlots<{
  default(props: { indentLevel: number }): any;
  postDecor(): any;
}>();

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};
</script>

<style lang="scss" scoped>
.tree-item {
  color: var(--vscode-foreground);
  position: relative;

  &.align-icon-with-twisty:not(.collapsible) .twisty-container {
    background-image: none !important;
    padding-right: 0 !important;
    visibility: hidden;
    width: 0 !important;
  }

  .tree-item-container {
    display: flex;
    align-items: center;
    overflow: hidden;
    padding-left: calc(v-bind(indentLevel) * 8px);
    padding-right: 12px;
    cursor: pointer;
    touch-action: none;
    user-select: none;

    .indent {
      width: calc(v-bind(indentLevel) * 8px);
      height: 100%;
      position: absolute;
      top: 0;
      left: 16px;
      pointer-events: none;

      .indent-guide {
        width: 8px;
        transition: border-color 0.1s linear;
        border-left: 1px solid transparent;
        display: inline-block;
        height: 100%;
      }
    }

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

      .indent .indent-guide {
        border-color: var(--vscode-tree-inactiveIndentGuidesStroke);
      }

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
