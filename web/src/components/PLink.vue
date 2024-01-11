<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <span
    v-if="vscodeApi"
    class="no-outline cursor-pointer"
    tabindex="0"
    @click="navigate"
    @keyup.enter="navigate"
  >
    <slot />
  </span>
  <RouterLink
    v-else
    v-bind="props"
  >
    <slot />
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink, RouterLinkProps, useRouter } from 'vue-router';

import { vscodeApi } from 'src/vscode';

const router = useRouter();

const props = defineProps<RouterLinkProps>();

function navigate() {
  router.push(props.to);
}
</script>
