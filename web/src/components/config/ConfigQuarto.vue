<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="quarto"
    label="Quarto"
  >
    {{ quarto }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { QuartoConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  quarto: {
    type: Object as PropType<QuartoConfig>,
    default: undefined,
    required: false,
  },
});
</script>

