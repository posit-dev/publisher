<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    v-model="selectedAccountName"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import NewDestinationHeader from './NewDestinationHeader.vue';

const route = useRoute();

const selectedAccountName = ref('');

const init = () => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.account)) {
    selectedAccountName.value = route.params.account[0];
  } else {
    selectedAccountName.value = route.params.account;
  }
};

onMounted(() => {
  init();
});

watch(
  () => route.params,
  () => {
    init();
  }
);
</script>
