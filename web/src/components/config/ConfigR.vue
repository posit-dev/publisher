<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="r"
    title="R"
  >
    <ConfigSetting
      label="Version"
      :value="r.version"
      :previous-value="previousR?.version"
    />

    <ConfigSetting
      label="Package File"
      :value="r.packageFile"
      :previous-value="previousR?.packageFile"
    />

    <ConfigSetting
      label="Package Manager"
      :value="r.packageManager"
      :previous-value="previousR?.packageManager"
    />
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
  previousR: {
    type: Object as PropType<RConfig>,
    default: undefined,
    required: false,
  }
});
</script>

