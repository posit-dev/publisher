<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="description"
    label="Description"
  >
    {{ description }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  description: {
    type: String,
    default: undefined,
    required: false,
  },
});
</script>

