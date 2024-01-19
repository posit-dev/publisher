<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="python"
    title="Python"
  >
    <ConfigSetting
      label="Version"
      :value="python.version"
      :previous-value="previousPython?.version"
    />

    <ConfigSetting
      label="Package File"
      :value="python.packageFile"
      :previous-value="previousPython?.packageFile"
    />

    <ConfigSetting
      label="Package Manager"
      :value="python.packageManager"
      :previous-value="previousPython?.packageManager"
    />
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
  previousPython: {
    type: Object as PropType<PythonConfig>,
    default: undefined,
    required: false,
  }
});
</script>

