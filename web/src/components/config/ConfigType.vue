<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <ConfigSetting
    v-if="type"
    label="Content Type"
    :value="type"
    :previous-value="previousType"
  />
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { ContentType } from 'src/api';
import ConfigSetting from 'src/components/config/ConfigSetting.vue';

defineProps({
  type: {
    type: String as PropType<ContentType>,
    default: undefined,
    required: false,
  },
  previousType: {
    type: String as PropType<ContentType>,
    default: undefined,
    required: false,
  },
});
</script>

