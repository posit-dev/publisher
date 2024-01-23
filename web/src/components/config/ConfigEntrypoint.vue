<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="entrypoint"
    label="Entrypoint"
    :value="entrypoint"
    :previous-value="previousEntrypoint"
  />
</template>

<script setup lang="ts">
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  entrypoint: {
    type: String,
    default: undefined,
    required: false,
  },
  previousEntrypoint: {
    type: String,
    default: undefined,
    required: false,
  },
});
</script>

