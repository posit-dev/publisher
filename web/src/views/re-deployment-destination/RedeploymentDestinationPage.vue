<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <RedeploymentDestinationHeader
    v-model="selectedAccountName"
    :content-id="contentID"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

import RedeploymentDestinationHeader from './RedeploymentDestinationHeader.vue';

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

const contentID = computed(():string => {
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

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
