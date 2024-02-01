<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    class="space-between-y-sm"
  >
    <p>{{ deployment.id }}</p>
    <p>
      Last Deployed on {{ formatDateString(deployment.deployedAt) }}
    </p>
    <template v-if="compact">
      <div class="flex items-center">
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
      <p class="text-bold">
        An error has been detected:
      </p>
      <ul
        v-if="deployment.deploymentError"
        class="text-caption"
      >
        <li>
          {{ deployment.deploymentError.code }}
          {{ deployment.deploymentError.operation }}
        </li>
        <li>
          {{ deployment.deploymentError.msg }}
        </li>
        <li v-if="scrubbedErrorData">
          <ul>
            <li
              v-for="(value, name, index) in scrubbedErrorData"
              :key="index"
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
import { Deployment } from 'src/api';
import { PropType, computed } from 'vue';
import { formatDateString } from 'src/utils/date';
import { scrubErrorData } from 'src/utils/errors';

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
  compact: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const scrubbedErrorData = computed(() => {
  return scrubErrorData(props.deployment.deploymentError?.data);
});

</script>
