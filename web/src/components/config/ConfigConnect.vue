<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="connect"
    label="Connect"
  >
    {{ connect }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ConnectConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  connect: {
    type: Object as PropType<ConnectConfig>,
    default: undefined,
    required: false,
  },
});
</script>

