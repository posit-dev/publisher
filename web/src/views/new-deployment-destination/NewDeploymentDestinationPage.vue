<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    v-model="selectedAccount"
    :url="destinationURL"
    class="q-mt-md"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';

import NewDestinationHeader from './NewDestinationHeader.vue';

const route = useRoute();

const destinationURL = 'https:://dogfood.posit.co';

const selectedAccount = ref(<string>route.params.account);

</script>
