<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div v-if="error" class="error-block">
    Configuration Error!
    <ul class="bullets">
      <li v-for="key in Object.keys(error.data)">
        {{ key }}: {{ error.data[key] }}
      </li>
    </ul>
    <a
      class="webview-link"
      role="button"
      @click="emit(`edit-active-configuration`)"
      >Edit the Configuration</a
    >
  </div>
</template>
<script setup lang="ts">
import { AgentError } from "../../../../../src/api/types/error";

const emit = defineEmits(["edit-active-configuration"]);

defineProps<{
  error: AgentError | undefined;
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
