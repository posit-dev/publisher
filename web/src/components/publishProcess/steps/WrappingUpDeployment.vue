<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PublishStep
    :name="name"
    title="Wrapping Up Deployment"
    icon="checklist"
    summary="Your project has been successfully deployed to the server and is available at https://rsc.radixu.com/connect/my-project"
    :done="done"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

import PublishStep from 'src/components/publishProcess/PublishStep.vue';

defineProps({
  name: { type: [String, Number], required: true },
});

const done = ref(false);
</script>

