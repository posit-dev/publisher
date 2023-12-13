<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard
    :title="config.configurationName"
    :icon="isConfigurationError(config) ? 'error' : undefined"
    :title-tooltip="isConfigurationError(config) ? config.error : undefined"
  >
    <p>{{ config.configurationPath }}</p>
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
