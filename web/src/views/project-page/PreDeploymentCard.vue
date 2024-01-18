<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <PCard
    :to="{ name: 'deployments', params: { name: `${preDeployment.saveName}` }}"
    :title="preDeployment.saveName"
  >
    <div
      class="space-between-y-sm"
    >
      <p>{{ preDeployment.serverUrl }}</p>
      <p>An ID will be created on first deployment.</p>
      <p>Never has been deployed.</p>
    </div>
  </PCard>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { PreDeployment } from 'src/api';
import PCard from 'src/components/PCard.vue';

defineProps({
  preDeployment: {
    type: Object as PropType<PreDeployment>,
    required: true,
  },
});

</script>
