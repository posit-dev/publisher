<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard :title="config.configurationName">
    <div
      v-if="isConfigurationError(config)"
      class="row items-center"
    >
      <q-icon
        name="error"
        size="1rem"
      />
      <p class="q-ml-sm">
        {{ config.error }}
      </p>
    </div>
  </pcard>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { Configuration, ConfigurationError, isConfigurationError } from 'src/api';
import PCard from 'src/components/PCard.vue';

defineProps({
  config: {
    type: Object as PropType<Configuration | ConfigurationError>,
    required: true,
  },
});
</script>
