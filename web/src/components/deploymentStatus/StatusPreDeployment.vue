<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div
    v-if="compact"
  >
    Never has been deployed
  </div>
  <div
    v-else
  >
    <div
      class="space-between-y-sm"
    >
      <p>An ID will be created on first deployment</p>
      <p>Never has been deployed</p>
    </div>
  </div>
</template>

<script setup lang="ts">

defineProps({
  compact: {
    type: Boolean,
    required: false,
    default: false,
  },
});

</script>
