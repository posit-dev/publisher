<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <h3
    v-if="connect"
    class="connect-title q-mt-md"
  >
    Connect
  </h3>

  <ConfigConnectAccess :access="connect?.access" />

  <ConfigConnectKubernetes :kubernetes="connect?.kubernetes" />

  <ConfigConnectRuntime :runtime="connect?.runtime" />
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ConnectConfig } from 'src/api';

import ConfigConnectAccess from './ConfigConnectAccess.vue';
import ConfigConnectKubernetes from './ConfigConnectKubernetes.vue';
import ConfigConnectRuntime from './ConfigConnectRuntime.vue';

defineProps({
  connect: {
    type: Object as PropType<ConnectConfig>,
    default: undefined,
    required: false,
  },
});
</script>

<style scoped lang="scss">
.connect-title {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.5;
}
</style>
