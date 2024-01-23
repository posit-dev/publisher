<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="environment"
    title="Environment"
  >
    <ConfigSetting
      v-for="(value, key) in environment"
      :key="key"
      :label="key"
      :value="value"
      :previous-value="previousEnvironment?.[key]"
    />
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { EnvironmentConfig } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  environment: {
    type: Object as PropType<EnvironmentConfig>,
    default: undefined,
    required: false,
  },
  previousEnvironment: {
    type: Object as PropType<EnvironmentConfig>,
    default: undefined,
    required: false,
  }
});
</script>

