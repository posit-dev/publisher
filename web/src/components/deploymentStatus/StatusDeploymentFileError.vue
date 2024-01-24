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
      class="text-caption error-msg"
    >
      <li>
        {{ deployment.error?.code }}
        {{ deployment.error?.operation }}
      </li>
      <li>
        {{ deployment.error?.msg }}
      </li>
      <li
        v-for="(value, name, index) in scrubbedErrorData"
        :key="index"
        class="error-data"
      >
        {{ name }}: {{ value }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { DeploymentError } from 'src/api';
import { PropType, computed } from 'vue';

const props = defineProps({
  deployment: {
    type: Object as PropType<DeploymentError>,
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
