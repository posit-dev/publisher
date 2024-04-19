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
        <h3 class="title">{{ title }}</h3>
      </div>
      <div v-if="actions" class="actions">
        <div class="monaco-toolbar">
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
        </div>
      </div>
    </div>
    <div v-if="expanded" class="pane-body">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo ad adipisci
      veniam rerum id dicta quos voluptatum ab voluptatem quibusdam hic totam,
      voluptate reiciendis odit consequatur iste blanditiis harum error! Lorem
      ipsum dolor sit amet consectetur adipisicing elit. Autem, veritatis!
      Quidem sequi reiciendis reprehenderit at, iure blanditiis veritatis quod
      amet eveniet sed officia accusamus vel enim tempora. Enim, eligendi ipsa.
    </div>
  </div>
</template>

<script setup lang="ts">
export type TreeAction = {
  label: string;
  codicon: string;
  fn: () => void;
};

const expanded = defineModel("expanded", { required: false, default: false });

defineProps<{
  title: string;
  actions?: TreeAction[];
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

    .monaco-toolbar {
      height: 100%;

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
            z-index: 2;
            margin-right: 4px;

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
    }
  }

  &.expanded:hover .actions,
  &.expanded:focus-within .actions {
    display: initial;
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

  &:focus {
    opacity: 1;
    outline-color: var(--vscode-focusBorder);
    outline-offset: -1px;
    outline-style: solid;
    outline-width: 1px;
  }

  .pane-header-title-container {
    display: flex;
    flex: 1;
    align-items: center;

    .twisty-container {
      margin: 0 2px;
      font-size: 16px;
      color: var(--vscode-icon-foreground);
    }

    .title {
      font-size: 11px;
      min-width: 3ch;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
      user-select: none;
      -webkit-margin-before: 0;
      -webkit-margin-after: 0;
    }
  }
}

.pane-body {
  flex: 1;
  overflow: hidden;
}
</style>
