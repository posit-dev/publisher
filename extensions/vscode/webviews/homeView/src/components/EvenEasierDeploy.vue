<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div class="label">
      <span>Destination:</span>

      <ActionToolbar
        title="Destination"
        :actions="toolbarActions"
        context-menu="even-easier-deploy-more-menu"
      />
    </div>

    <div
      class="destination-control"
      :disabled="home.deployments.length === 0 ? true : undefined"
      v-on="home.deployments.length ? { click: onSelectDestination } : {}"
    >
      <QuickPickItem
        v-if="
          home.selectedDeployment &&
          home.selectedConfiguration &&
          home.selectedCredential
        "
        :label="home.selectedDeployment.saveName"
        :description="home.selectedConfiguration.configurationName"
        :detail="home.selectedCredential.name"
      />
      <QuickPickItem
        v-else
        class="text-placeholder"
        label="Select a Destination"
        detail="Get deploying"
      />
      <div
        class="select-indicator codicon codicon-chevron-down"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";
import QuickPickItem from "src/components/QuickPickItem.vue";
import ActionToolbar from "src/components/ActionToolbar.vue";

const home = useHomeStore();
const hostConduit = useHostConduitService();

const toolbarActions = computed(() => {
  const result = [];
  result.push({
    label: "Add Destination",
    codicon: "codicon-add",
    fn: onAddDestination,
  });

  if (home.selectedConfiguration) {
    result.push({
      label: "Edit Configuration",
      codicon: "codicon-edit",
      fn: () =>
        hostConduit.sendMsg({
          kind: WebviewToHostMessageType.EDIT_CONFIGURATION,
          content: {
            configurationName: home.selectedConfiguration!.configurationName,
          },
        }),
    });
  }
  return result;
});

const onSelectDestination = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.SELECT_DESTINATION,
  });
};

const onAddDestination = () => {
  hostConduit.sendMsg({
    kind: WebviewToHostMessageType.NEW_DESTINATION,
  });
};
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
  &:active:not([disabled]) {
    border-color: var(--focus-border);
  }

  &[disabled] {
    cursor: not-allowed;
    opacity: var(--disabled-opacity);
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
