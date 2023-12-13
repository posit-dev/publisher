<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="r"
    label="R"
  >
    <dt>Version</dt>
    <dd>{{ r.version }}</dd>

    <dt>Package File</dt>
    <dd>{{ r.packageFile }}</dd>

    <dt>Package Manager</dt>
    <dd>{{ r.packageManager }}</dd>
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

