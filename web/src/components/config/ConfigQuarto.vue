<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="quarto"
    title="Quarto"
  >
    <ConfigSetting
      label="Version"
      :value="quarto.version"
      :previous-value="previousQuarto?.version"
    />

    <ConfigSetting
      v-if="quarto.engines"
      label="Engines"
      :value="quarto.engines.join(', ')"
      :previous-value="previousQuarto?.engines?.join(', ')"
    />
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { QuartoConfig } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  quarto: {
    type: Object as PropType<QuartoConfig>,
    default: undefined,
    required: false,
  },
  previousQuarto: {
    type: Object as PropType<QuartoConfig>,
    default: undefined,
    required: false,
  }
});
</script>

