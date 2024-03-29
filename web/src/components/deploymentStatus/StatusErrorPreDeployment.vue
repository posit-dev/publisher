<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="space-between-y-sm">
    <template v-if="compact">
      <p>
        Created
        <relative-time :datetime="deployment.createdAt">
          {{ formatDateString(deployment.createdAt) }}
        </relative-time>
      </p>
      <div class="flex items-center">
        <q-icon name="error" size="1rem" />
        <div class="q-ml-sm text-left text-bold">
          Deploying Operation has failed.
        </div>
      </div>
    </template>
    <template v-else>
      Created
      <relative-time :datetime="deployment.createdAt">
        {{ formatDateString(deployment.createdAt) }}
      </relative-time>
      <p class="text-bold">An error has been detected:</p>
      <ul v-if="deployment.error" class="text-caption">
        <li>
          {{ deployment.error.code }}
          {{ deployment.error.operation }}
        </li>
        <li>
          {{ deployment.error.msg }}
        </li>
        <li v-if="scrubbedErrorData">
          <ul>
            <li
              v-for="(value, name, index) in scrubbedErrorData"
              :key="index"
              class="error-data"
            >
              {{ name }}: {{ value }}
            </li>
          </ul>
        </li>
      </ul>
      <p v-else>No info on error is available.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PreDeployment } from "src/api";
import { PropType, computed } from "vue";
import { formatDateString } from "src/utils/date";
import { scrubErrorData } from "src/utils/errors";

const props = defineProps({
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

const scrubbedErrorData = computed(() => {
  return scrubErrorData(props.deployment.error?.data);
});
</script>
