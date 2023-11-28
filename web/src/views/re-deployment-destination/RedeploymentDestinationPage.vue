<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <RedeploymentDestinationHeader
    v-model="selectedAccount"
    :url="destinationURL"
    :content-id="contentID"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

import RedeploymentDestinationHeader from './RedeploymentDestinationHeader.vue';

const destinationURL = 'https:://dogfood.posit.co';

const selectedAccount = ref(<string>route.params.account);

const contentID = computed(():string => {
  if (Array.isArray(route.params.id)) {
    return route.params.id[0];
  }
  return route.params.id;
});

</script>
