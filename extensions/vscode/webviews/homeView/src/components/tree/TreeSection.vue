<template>
  <div class="pane" :class="{ expanded: expanded }">
    <div
      class="pane-header"
      tabindex="0"
      :class="{ expanded: expanded }"
      @keydown.enter.self="toggleExpanded"
    >
      <div class="pane-header-title-container" @click="toggleExpanded">
        <div
          class="twisty-container codicon"
          :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        />
        <span
          v-if="codicon"
          class="tree-section-icon codicon"
          :class="codicon"
        />
        <h3 class="title">{{ title }}</h3>
        <span v-if="$slots.description" class="description">
          <slot name="description" />
        </span>
        <span v-else-if="description" class="description">
          {{ description }}
        </span>
      </div>
      <div v-if="actions" class="actions">
        <ActionToolbar :title="title" :actions="actions" />
      </div>
    </div>
    <div v-show="expanded" class="pane-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToolbar, { ActionButton } from "src/components/ActionToolbar.vue";

const expanded = defineModel("expanded", { required: false, default: false });

defineProps<{
  title: string;
  description?: string;
  codicon?: string;
  actions?: ActionButton[];
}>();

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};
</script>

<style lang="scss" scoped>
.pane {
  .actions {
    display: none;
    margin-left: auto;
  }

  &.expanded:hover .actions,
  &.expanded:focus-within .actions {
    display: initial;
  }

  &.expanded:hover
    :deep(.tree-item .tree-item-container:not(:hover) .indent .indent-guide),
  &.expanded:focus-within
    :deep(.tree-item .tree-item-container:not(:hover) .indent .indent-guide) {
    border-color: var(--vscode-tree-inactiveIndentGuidesStroke);
  }
}

.pane-header {
  line-height: 22px;
  color: var(--vscode-sideBarSectionHeader-foreground);
  background-color: var(--vscode-sideBarSectionHeader-background);
  border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  position: relative;
  align-items: center;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  height: 22px;
  overflow: hidden;
  user-select: none;

  &:focus {
    opacity: 1;
    outline-color: var(--vscode-focusBorder);
    outline-offset: -1px;
    outline-style: solid;
    outline-width: 1px;
  }

  .pane-header-title-container {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;

    .twisty-container {
      margin: 0 2px;
      font-size: 16px;
      color: var(--vscode-icon-foreground);
    }

    .tree-section-icon {
      font-size: 13px;
      margin-right: 4px;
    }

    .title {
      font-size: 11px;
      min-width: 3ch;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
      -webkit-margin-before: 0;
      -webkit-margin-after: 0;
    }

    .description {
      display: block;
      color: var(--vscode-sideBarSectionHeader-foreground);
      flex-shrink: 100000;
      font-weight: 400;
      margin: 0;
      margin-left: 10px;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: none;
      white-space: nowrap;
    }
  }

  & :deep(.action-item) {
    margin-right: 4px;
  }
}

.pane-body {
  flex: 1;
  overflow: hidden;
}
</style>
