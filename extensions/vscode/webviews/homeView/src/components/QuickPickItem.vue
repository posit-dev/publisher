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
    <div class="quick-pick-row">
      <span class="quick-pick-detail">{{ detail }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
  detail: string;
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
    }
  }
}
</style>
