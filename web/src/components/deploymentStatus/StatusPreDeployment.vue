<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div
      class="space-between-y-sm"
    >
      <p>
        Created {{ formatDistanceToNow(deployment.createdAt, { addSuffix: true }) }}
      </p>
      <p>An ID will be created on first deployment</p>
      <p>Never has been deployed</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns';
import { PropType } from 'vue';

import { PreDeployment } from 'src/api';

defineProps({
  deployment: {
    type: Object as PropType<PreDeployment>,
    required: true,
  },
});

</script>
