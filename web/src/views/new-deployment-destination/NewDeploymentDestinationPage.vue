<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    :account-name="accountName"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import NewDestinationHeader from './NewDestinationHeader.vue';

const route = useRoute();

const accountName = computed(() => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.account)) {
    return route.params.account[0];
  }
  return route.params.account;
});

</script>
