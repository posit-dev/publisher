<template>
  <div class="monaco-list-row">
    <div class="monaco-tl-row">
      <div class="resource">
        <div class="name">
          <div
            class="monaco-icon-label file-icon .vscode-name-dir-icon settings.json-name-file-icon name-file-icon json-ext-file-icon ext-file-icon jsonc-lang-file-icon monaco-decoration-itemBadge-kkyaq5 monaco-decoration-iconBadge-kkyaq5"
            aria-label="~/development/publishing-client/extensions/vscode/.vscode/settings.json • Modified"
          >
            <div class="monaco-icon-label-container">
              <span class="monaco-icon-name-container">
                <a class="label-name">
                  <span class="monaco-highlighted-label">{{ title }}</span>
                </a>
              </span>
              <span
                v-if="description"
                class="monaco-icon-description-container"
              >
                <span class="label-description">
                  <span class="monaco-highlighted-label">
                    {{ description }}
                  </span>
                </span>
              </span>
            </div>
            <div v-if="actions" class="actions">
              <ActionToolbar :title="title" :actions="actions" />
            </div>
          </div>
        </div>
        <div class="decoration-icon" title="" style="display: none"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToolbar, { ActionButton } from "./ActionToolbar.vue";

defineProps<{
  title: string;
  description?: string;
  actions?: ActionButton[];
}>();
</script>

<style lang="scss" scoped>
.monaco-list-row {
  color: var(--vscode-foreground);
  cursor: pointer;
  touch-action: none;
  overflow: hidden;

  .monaco-tl-row {
    display: flex;
    align-items: center;
    position: relative;
    overflow: hidden;

    .resource {
      display: flex;
      flex: 1;
      overflow: hidden;
      padding-left: 16px;
      padding-right: 12px;

      .name {
        flex: 1;
        overflow: hidden;

        .monaco-icon-label {
          display: flex;
          text-overflow: ellipsis;
          overflow: hidden;

          .monaco-icon-label-container {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;

            .monaco-icon-name-container {
              line-height: 22px;

              .label-name {
                color: inherit;
                white-space: pre;
              }
            }

            .monaco-icon-description-container {
              line-height: 22px;

              .label-description {
                font-size: 0.9em;
                margin-left: 0.5em;
                opacity: 0.7;
                white-space: pre;
              }
            }
          }
        }
      }
    }
  }

  &:hover {
    color: var(--vscode-list-hoverForeground);
    background-color: var(--vscode-list-hoverBackground);

    .label-name {
      color: var(--vscode-list-hoverForeground);
    }

    .label-description {
      color: var(--vscode-list-hoverForeground);
    }
  }
}

.monaco-list-row {
  .actions {
    display: none;
    max-width: fit-content;
    flex-grow: 100;
  }

  &:hover .actions,
  &:focus-within .actions {
    display: initial;
  }
}
</style>
