<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="access"
    title="Connect Access"
  >
    <ConfigSetting
      v-if="access.runAs !== undefined"
      label="Run As"
    >
      {{ access.runAs }}
    </ConfigSetting>

    <ConfigSetting
      v-if="access.runAsCurrentUser !== undefined"
      label="Run As Current User"
    >
      {{ access.runAsCurrentUser }}
    </ConfigSetting>
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ConnectAccess } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  access: {
    type: Object as PropType<ConnectAccess>,
    default: undefined,
    required: false,
  },
});
</script>
