<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard
    :title="deploymentError.deploymentName"
  >
    <div class="space-between-sm">
      <p class="text-bold">
        An error has been detected: {{ deploymentError.error.code }}
      </p>
      <p class="error-msg">
        {{ deploymentError.error.msg }}
      </p>
      <p
        v-for="(value, name, index) in scrubbedErrorData"
        :key="index"
        class="error-data"
      >
        {{ name }}: {{ value }}
      </p>
    </div>
  </PCard>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';

import { DeploymentError } from 'src/api';
import PCard from 'src/components/PCard.vue';

const props = defineProps({
  deploymentError: {
    type: Object as PropType<DeploymentError>,
    required: true,
  },
});

const scrubbedErrorData = computed(() => {
  const result = {
    ...props.deploymentError.error.data,
  };
  if (result.file) {
    delete result.file;
  }
  return result;
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
