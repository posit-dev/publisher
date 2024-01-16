<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="title"
    label="Title"
  >
    <div class="space-between-x-xs">
      <span
        v-if="Boolean(previousTitle)"
        class="text-strike"
      >
        {{ previousTitle }}
      </span>
      <span>{{ title }}</span>
    </div>
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
  previousTitle: {
    type: String,
    default: undefined,
    required: false,
  },
});
</script>

