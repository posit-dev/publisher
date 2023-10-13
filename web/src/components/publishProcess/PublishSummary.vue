<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <section>
    <ul>
      <li>Destination: {{ deploymentStore.deployment?.target.accountName }}</li>
      <li>Files: {{ filesSummary }}</li>
      <li>Python: Version {{ deploymentStore.deployment?.manifest.python?.version }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useDeploymentStore } from 'src/stores/deployment';

const deploymentStore = useDeploymentStore();

const filesSummary = computed(() => {
  const path = deploymentStore.deployment?.sourcePath;
  const count = deploymentStore.files.length;
  return `${count} files selected from ${path}`;
});
</script>

