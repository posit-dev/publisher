<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    :account-name="accountName"
    :content-id="contentId"
    @publish="hasPublished = true"
  />

  <div class="publisher-layout q-pb-xl space-between-lg">
    <ConfigSettings
      v-if="defaultConfig"
      class="q-mt-lg"
      :config="defaultConfig"
    />
    <p v-else>
      No default configuration found.
      One will be created automatically on publish.
    </p>

    <h2 class="text-h6">
      Files
    </h2>
    <FileTree />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

import { Configuration, ConfigurationError, useApi } from 'src/api';
import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import NewDestinationHeader from './NewDestinationHeader.vue';

const route = useRoute();
const hasPublished = ref(false);
const api = useApi();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

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

const defaultConfig = computed(() => {
  return configurations.value.find((c) => c.configurationName === 'default');
});

onBeforeRouteLeave(() => {
  if (hasPublished.value) {
    return true;
  }
  // eslint-disable-next-line no-alert
  return confirm('You have not published yet, a destination has not been created. Are you sure you want to leave?');
});

async function getConfigurations() {
  const response = await api.configurations.getAll();
  configurations.value = response.data;
}

getConfigurations();
</script>
