<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="title"
    label="Title"
  >
    {{ title }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  title: {
    type: String,
    default: undefined,
    required: false,
  },
});
</script>

