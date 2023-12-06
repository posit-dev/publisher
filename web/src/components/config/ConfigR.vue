<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="r"
    label="R"
  >
    {{ r }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { RConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  r: {
    type: Object as PropType<RConfig>,
    default: undefined,
    required: false,
  },
});
</script>

