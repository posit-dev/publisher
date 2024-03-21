<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="space-between-y-sm">
    <p>{{ deployment.id }}</p>
    <p>
      Deployed
      <relative-time :datetime="deployment.deployedAt">
        {{ formatDateString(deployment.deployedAt) }}
      </relative-time>
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
import { Deployment } from "src/api";
import { PropType } from "vue";
import { formatDateString } from "src/utils/date";

defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});
</script>
