<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    :account-name="accountName"
    :content-id="contentId"
    class="q-mt-md"
    @publish="hasPublished = true"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

import NewDestinationHeader from './NewDestinationHeader.vue';

const route = useRoute();
const hasPublished = ref(false);

const accountName = computed(() => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.account)) {
    return route.params.account[0];
  }
  return route.params.account;
});

const contentId = computed(() => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.contentId)) {
    return route.params.contentId[0] || undefined;
  }
  return route.params.contentId || undefined;
});

onBeforeRouteLeave(() => {
  if (hasPublished.value) {
    return true;
  }
  // eslint-disable-next-line no-alert
  return confirm('You have not published yet, a destination has not been created. Are you sure you want to leave?');
});

</script>
