<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="environment"
    label="Environment"
  >
    {{ environment }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { EnvironmentConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  environment: {
    type: Object as PropType<EnvironmentConfig>,
    default: undefined,
    required: false,
  },
});
</script>

