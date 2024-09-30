<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="error-block">
    Configuration Error!
    <ul class="bullets">
      <li>File Missing</li>
      <li>The last Configuration used for this Deployment was not found.</li>
    </ul>
    <a
      class="webview-link"
      role="button"
      @click="emit(`select-configuration`)"
      >{{ configSelectionPrompt }}</a
    >
  </div>
</template>

<script setup lang="ts">
import { useHomeStore } from "src/stores/home";

const home = useHomeStore();

const emit = defineEmits(["select-configuration"]);

const props = defineProps<{
  configSelectionPrompt: string;
}>();
</script>
<style lang="scss" scoped>
.bullets {
  margin: 0;
  padding: 0 0 3px 15px;
}
.error-block {
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
}
</style>
