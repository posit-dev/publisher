<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div class="label">
      <span>Destination:</span>

      <ActionToolbar
        title="Destination"
        :actions="[
          {
            label: 'Add Destination',
            codicon: 'codicon-add',
            fn: () => console.log('Add Destination'),
          },
          {
            label: 'Edit Configuration',
            codicon: 'codicon-edit',
            fn: () => console.log('Edit Configuration'),
          },
          {
            label: 'More Deployment Actions',
            codicon: 'codicon-ellipsis',
            fn: () => console.log('More'),
          },
        ]"
      />
    </div>

    <div class="destination-control">
      <QuickPickItem
        label="Connect title"
        description="default"
        detail="rsc.radixu.com"
      />
      <div
        class="select-indicator codicon codicon-chevron-down"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import QuickPickItem from "src/components/QuickPickItem.vue";
import ActionToolbar from "./ActionToolbar.vue";
</script>

<style lang="scss" scoped>
.label {
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
}

.destination-control {
  display: flex;
  align-items: center;

  cursor: pointer;
  margin: 0.5rem 0 1rem;
  padding: 2px 6px 6px 8px;
  background: var(--dropdown-background);
  border: calc(var(--border-width) * 1px) solid var(--dropdown-border);
  border-radius: calc(var(--corner-radius-round) * 1px);
  position: relative;
  user-select: none;
  outline: none;

  &[open],
  &:active {
    border-color: var(--focus-border);
  }

  .select-indicator {
    flex: none;
    margin-inline-start: 1em;
  }
}

:deep(.action-item) {
  margin-right: 4px;
}
</style>
