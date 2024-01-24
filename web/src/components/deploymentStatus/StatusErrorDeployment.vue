<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    class="space-between-y-sm"
  >
    <p>{{ deployment.id }}</p>
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
        v-if="deployment.deploymentError?.code"
        class="text-caption error-msg"
      >
        <li>
          {{ deployment.deploymentError?.code }}
          ({{ deployment.deploymentError?.operation }})
        </li>
        <li>
          {{ deployment.deploymentError?.msg }}
        </li>
        <li
          v-for="(value, name, index) in scrubbedErrorData"
          :key="index"
          class="error-data"
        >
          {{ name }}: {{ value }}
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
  if (!props.deployment.deploymentError?.data) {
    return {};
  }

  // remove what we don't want to display
  // in this unknown list of attributes
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-shadow
    file, method, status, url,
    ...remainingData
  } = props.deployment.deploymentError?.data as Record<string, string>;

  return remainingData;
});

</script>
<style scoped lang="scss">
.error-msg {
  text-wrap: wrap;
}
.error-data {
  margin-left: 15px;
  margin-top: 2px;
  margin-bottom: 2px;
}
</style>
