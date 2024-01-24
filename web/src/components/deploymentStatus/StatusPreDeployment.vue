<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    v-if="compact"
  >
    Never has been deployed
  </div>
  <div
    v-else
  >
    <div
      class="space-between-y-sm"
    >
      <p>An ID will be created on first deployment</p>
      <p>Never has been deployed</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PreDeployment } from 'src/api';
import { PropType } from 'vue';

defineProps({
  deployment: {
    type: Object as PropType<PreDeployment>,
    required: true,
  },
  compact: {
    type: Boolean,
    required: false,
    default: false,
  },
});

</script>
