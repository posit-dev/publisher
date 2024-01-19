<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSection
    v-if="runtime"
    title="Connect Runtime"
  >
    <ConfigSetting
      v-if="runtime.connectionTimeout !== undefined"
      label="Connection Timeout"
      :value="runtime.connectionTimeout"
      :previous-value="previousRuntime?.connectionTimeout"
    />

    <ConfigSetting
      v-if="runtime.readTimeout !== undefined"
      label="Read Timeout"
      :value="runtime.readTimeout"
      :previous-value="previousRuntime?.readTimeout"
    />

    <ConfigSetting
      v-if="runtime.initTimeout !== undefined"
      label="Init Timeout"
      :value="runtime.initTimeout"
      :previous-value="previousRuntime?.initTimeout"
    />

    <ConfigSetting
      v-if="runtime.idleTimeout !== undefined"
      label="Idle Timeout"
      :value="runtime.idleTimeout"
      :previous-value="previousRuntime?.idleTimeout"
    />

    <ConfigSetting
      v-if="runtime.maxProcesses !== undefined"
      label="Max Processes"
      :value="runtime.maxProcesses"
      :previous-value="previousRuntime?.maxProcesses"
    />

    <ConfigSetting
      v-if="runtime.minProcesses !== undefined"
      label="Min Processes"
      :value="runtime.minProcesses"
      :previous-value="previousRuntime?.minProcesses"
    />

    <ConfigSetting
      v-if="runtime.maxConnections !== undefined"
      label="Max Connections"
      :value="runtime.maxConnections"
      :previous-value="previousRuntime?.maxConnections"
    />

    <ConfigSetting
      v-if="runtime.loadFactor !== undefined"
      label="Load Factor"
      :value="runtime.loadFactor"
      :previous-value="previousRuntime?.loadFactor"
    />
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
  previousRuntime: {
    type: Object as PropType<ConnectRuntime>,
    default: undefined,
    required: false,
  }
});
</script>

