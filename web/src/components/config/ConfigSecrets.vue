<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="secrets"
    label="Secrets"
  >
    <ul>
      <li
        v-for="secret in secrets"
        :key="secret"
      >
        {{ secret }}
      </li>
    </ul>
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  secrets: {
    type: Array as PropType<string[]>,
    default: undefined,
    required: false,
  },
});
</script>
