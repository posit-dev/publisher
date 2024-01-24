<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    v-if="compact"
    class="flex items-center"
  >
    <q-icon
      name="error"
      size="1rem"
    />
    <div class="q-ml-sm text-left text-bold">
      Deploying Operation has failed.
    </div>
  </div>
  <div
    v-else
    class="space-between-sm"
  >
    Error Information not yet available
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
