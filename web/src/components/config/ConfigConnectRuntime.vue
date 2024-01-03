<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="runtime"
    title="Connect Runtime"
  >
    <ConfigSetting
      v-if="runtime.connectionTimeout !== undefined"
      label="Connection Timeout"
    >
      {{ runtime.connectionTimeout }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.readTimeout !== undefined"
      label="Read Timeout"
    >
      {{ runtime.readTimeout }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.initTimeout !== undefined"
      label="Init Timeout"
    >
      {{ runtime.initTimeout }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.idleTimeout !== undefined"
      label="Idle Timeout"
    >
      {{ runtime.idleTimeout }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.maxProcesses !== undefined"
      label="Max Processes"
    >
      {{ runtime.maxProcesses }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.minProcesses !== undefined"
      label="Min Processes"
    >
      {{ runtime.minProcesses }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.maxConnections !== undefined"
      label="Max Connections"
    >
      {{ runtime.maxConnections }}
    </ConfigSetting>

    <ConfigSetting
      v-if="runtime.loadFactor !== undefined"
      label="Load Factor"
    >
      {{ runtime.loadFactor }}
    </ConfigSetting>
  </ConfigSection>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ConnectRuntime } from 'src/api';
import ConfigSection from 'src/components/config/ConfigSection.vue';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  runtime: {
    type: Object as PropType<ConnectRuntime>,
    default: undefined,
    required: false,
  },
});
</script>

