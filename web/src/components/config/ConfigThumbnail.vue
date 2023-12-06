<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="thumbnail"
    label="Thumbnail"
  >
    {{ thumbnail }}
  </ConfigSetting>
</template>

<script setup lang="ts">
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  thumbnail: {
    type: String,
    default: undefined,
    required: false,
  },
});
</script>

