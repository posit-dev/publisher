<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="python"
    label="Python"
  >
    <dt>Version</dt>
    <dd>{{ python.version }}</dd>

    <dt>Package File</dt>
    <dd>{{ python.packageFile }}</dd>

    <dt>Package Manager</dt>
    <dd>{{ python.packageManager }}</dd>
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { PythonConfig } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  python: {
    type: Object as PropType<PythonConfig>,
    default: undefined,
    required: false,
  },
});
</script>

