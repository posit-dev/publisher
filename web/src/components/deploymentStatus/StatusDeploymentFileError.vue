<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="space-between-y-sm">
    <div class="flex items-center">
      <q-icon
        name="error"
        size="1rem"
      />
      <div class="q-ml-sm text-left text-bold">
        Invalid Deployment File
      </div>
    </div>
    <p class="text-bold">
      Errors found:
    </p>
    <ul
      v-if="deployment.error?.code"
      class="text-caption"
    >
      <li>
        {{ deployment.error?.code }}
        {{ deployment.error?.operation }}
      </li>
      <li>
        {{ deployment.error?.msg }}
      </li>
      <li>
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
  </div>
</template>

<script setup lang="ts">
import { DeploymentError } from 'src/api';
import { PropType, computed } from 'vue';
import { scrubErrorData } from 'src/utils/errors';

const props = defineProps({
  deployment: {
    type: Object as PropType<DeploymentError>,
    required: true,
  },
});

const scrubbedErrorData = computed(() => {
  return scrubErrorData(props.deployment.error?.data);
});

</script>
