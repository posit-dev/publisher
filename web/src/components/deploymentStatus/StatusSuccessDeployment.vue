<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    class="space-between-y-sm"
  >
    <p>{{ deployment.id }}</p>
    <p>
      Last Deployed {{ formatDistanceToNow(deployment.deployedAt, { addSuffix: true }) }}
    </p>
    <div>
      <a
        :href="deployment.dashboardUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        Access through Connect dashboard
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns';
import { PropType } from 'vue';

import { Deployment } from 'src/api';

defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});

</script>
