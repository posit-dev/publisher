<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <!-- Shows Deployment status of never, last successful, last failed, currently in progress -->
  abc
</template>

<script setup lang="ts">
import { Deployment } from 'src/api';
import { PropType } from 'vue';

// Should be able to show compact mode or not

defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});
</script>
