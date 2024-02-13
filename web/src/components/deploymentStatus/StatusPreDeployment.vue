<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div>
    <div
      class="space-between-y-sm"
    >
      <p>
        Created
        <relative-time :datetime="deployment.createdAt">
          {{ formatDateString(deployment.createdAt) }}
        </relative-time>
      </p>
      <p>An ID will be created on first deployment</p>
      <p>Never has been deployed</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PreDeployment } from 'src/api';
import { formatDateString } from 'src/utils/date';
import { PropType } from 'vue';

defineProps({
  deployment: {
    type: Object as PropType<PreDeployment>,
    required: true,
  },
});

</script>
