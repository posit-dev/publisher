<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Destination"
    :subtitle="destinationTitle"
    icon="img:images/posit-logo-only-unofficial.svg"
  >
    TODO: select from previous deployments or add to existing or new targets
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import LayoutPanel from 'src/components/LayoutPanel.vue';
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
