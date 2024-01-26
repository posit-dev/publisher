<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    class="space-between-y-sm"
  >
    <template v-if="compact">
      <p>
        Created on {{ formatDateString(deployment.createdAt) }}
      </p>
      <div
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
    </template>
    <template v-else>
      <p>
        Created on {{ formatDateString(deployment.createdAt) }}
      </p>
      <p class="text-bold">
        An error has been detected:
      </p>
      <ul
        v-if="deployment.error"
        class="text-caption"
      >
        <li>
          {{ deployment.error.code }}
          {{ deployment.error.operation }}
        </li>
        <li>
          {{ deployment.error.msg }}
        </li>
        <li>
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
      <p v-else>
        No info on error is available.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PreDeployment } from 'src/api';
import { PropType, computed } from 'vue';
import { formatDateString } from 'src/utils/date';

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
  if (!props.deployment.error?.data) {
    return {};
  }

  // remove what we don't want to display
  // in this unknown list of attributes
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-shadow
    file, method, status, url,
    ...remainingData
  } = props.deployment.error?.data as Record<string, string>;

  return remainingData;
});

</script>
