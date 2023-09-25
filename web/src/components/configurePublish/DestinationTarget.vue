<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Destination"
    :subtitle="destinationTitle"
  >
    <template #avatar>
      <PublisherDestinationLogo />
    </template>
    TODO: select from previous deployments or add to existing or new targets
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherDestinationLogo from 'src/components/icons/PublisherDestinationLogo.vue';

import { useDeploymentStore } from 'src/stores/deployment';

const deploymentStore = useDeploymentStore();

const destinationTitle = computed(() => {
  const accountName = deploymentStore.deployment?.target.accountName;
  if (accountName) {
    return `New deployment on ${accountName}`;
  }
  return '';
});

</script>
