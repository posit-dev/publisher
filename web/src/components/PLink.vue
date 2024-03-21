<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <span
    v-if="vscode"
    class="vscode-router-link cursor-pointer"
    tabindex="0"
    @click="navigate"
    @keyup.enter="navigate"
  >
    <slot />
  </span>
  <RouterLink v-else v-bind="props">
    <slot />
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink, RouterLinkProps, useRouter } from "vue-router";

import { vscode } from "src/vscode";

const router = useRouter();

const props = defineProps<RouterLinkProps>();

function navigate() {
  router.push(props.to);
}
</script>

<style lang="scss" scoped>
span.vscode-router-link {
  color: var(--vscode-textLink-foreground);
  text-decoration: underline;

  &:not(:focus-visible) {
    outline: none;
  }

  &:hover {
    color: var(--vscode-textLink-activeForeground);
  }
}
</style>
