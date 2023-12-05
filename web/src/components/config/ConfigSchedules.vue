<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="schedules"
    label="Schedules"
  >
    {{ schedules }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ScheduleConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  schedules: {
    type: Array as PropType<ScheduleConfig[]>,
    default: undefined,
    required: false,
  },
});
</script>

