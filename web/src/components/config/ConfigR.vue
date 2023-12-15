<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="r"
    title="R"
  >
    <ConfigSetting label="Version">
      {{ r.version }}
    </ConfigSetting>

    <ConfigSetting label="Package File">
      {{ r.packageFile }}
    </ConfigSetting>

    <ConfigSetting label="Package Manager">
      {{ r.packageManager }}
    </ConfigSetting>
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { RConfig } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  r: {
    type: Object as PropType<RConfig>,
    default: undefined,
    required: false,
  },
});
</script>

