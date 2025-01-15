<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="quick-pick-option">
    <div class="quick-pick-row">
      <div v-if="codicon" class="quick-pick-icon codicon" :class="codicon" />
      <div class="quick-pick-label-container">
        <span class="quick-pick-label">{{ label }}</span>
        <span v-if="description" class="quick-pick-description">
          {{ description }}
        </span>
      </div>
    </div>
    <div v-for="detail in details" class="quick-pick-row">
      <div v-if="isIconDetail(detail)" class="quick-pick-detail">
        <div class="quick-pick-icon codicon" :class="detail.icon" />
        <span>{{ detail.text }}</span>
      </div>
      <span v-else class="quick-pick-detail">{{ detail }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
export type IconDetail = { icon: string; text: string };

const isIconDetail = (detail: string | IconDetail): detail is IconDetail =>
  typeof detail === "object" && "icon" in detail && "text" in detail;

defineProps<{
  label: string;
  description?: string;
  details: Array<string | IconDetail>;
  codicon?: string;
}>();
</script>

<style lang="scss" scoped>
.quick-pick-option {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  text-overflow: ellipsis;

  .quick-pick-row {
    display: flex;
    align-items: center;

    &:not(:only-child) {
      .quick-pick-label-container {
        .quick-pick-label {
          font-weight: 600;
          margin-bottom: 4px;
        }
      }
    }

    &:not(:last-child) {
      .quick-pick-detail {
        margin-bottom: 2px;
      }
    }

    .quick-pick-icon {
      vertical-align: text-bottom;
      padding-right: 6px;
    }

    .quick-pick-label-container {
      display: flex;
      flex: 1;
      align-items: baseline;
      overflow: hidden;
      text-overflow: ellipsis;

      .quick-pick-label {
        line-height: 22px;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 2 1;
        max-width: fit-content;
      }

      .quick-pick-description {
        font-size: 0.9em;
        margin-left: 0.5em;
        opacity: 0.7;
        white-space: pre;
        overflow: hidden;
        flex: 1 1;
        text-overflow: ellipsis;
      }
    }

    .quick-pick-detail {
      line-height: normal;
      opacity: 0.7;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre;

      .quick-pick-icon {
        font-size: var(--vscode-font-size);
      }
    }
  }
}
</style>
