<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="tags"
    label="Tags"
  >
    <ul>
      <li
        v-for="tag in tags"
        :key="tag"
      >
        {{ tag }}
      </li>
    </ul>
  </ConfigSetting>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  tags: {
    type: Array as PropType<string[]>,
    default: undefined,
    required: false,
  },
});
</script>

