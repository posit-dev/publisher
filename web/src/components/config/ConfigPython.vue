<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="python"
    title="Python"
  >
    <ConfigSetting label="Version">
      {{ python.version }}
    </ConfigSetting>

    <ConfigSetting label="Package File">
      {{ python.packageFile }}
    </ConfigSetting>

    <ConfigSetting label="Package Manager">
      {{ python.packageManager }}
    </ConfigSetting>
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { PythonConfig } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  python: {
    type: Object as PropType<PythonConfig>,
    default: undefined,
    required: false,
  },
});
</script>

