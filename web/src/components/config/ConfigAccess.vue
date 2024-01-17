<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="access"
    label="Access"
  >
    {{ access }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { AccessConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  access: {
    type: Object as PropType<AccessConfig>,
    default: undefined,
    required: false,
  },
  previousAccess: {
    type: Object as PropType<AccessConfig>,
    default: undefined,
    required: false,
  }
});
</script>

