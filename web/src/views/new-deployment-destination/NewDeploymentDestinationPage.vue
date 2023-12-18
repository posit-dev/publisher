<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <NewDestinationHeader
    :account-name="accountName"
    :content-id="contentId"
    :destination-name="destinationName"
    @publish="hasPublished = true"
  />

  <DeploymentSection
    title="Configuration"
    :subtitle="defaultConfig?.configurationName ||
      'No default configuration found. One will be created automatically on publish'"
  >
    <ConfigSettings
      v-if="defaultConfig"
      :config="defaultConfig"
    />
  </DeploymentSection>

  <DeploymentSection title="Files">
    <FileTree />
  </DeploymentSection>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { PropType, computed, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import { Configuration, ConfigurationError, useApi } from 'src/api';
import { newFatalErrorRouteLocation } from 'src/util/errors';

import ConfigSettings from 'src/components/config/ConfigSettings.vue';
import FileTree from 'src/components/FileTree.vue';
import NewDestinationHeader from './NewDestinationHeader.vue';
import DeploymentSection from 'src/components/DeploymentSection.vue';

const route = useRoute();
const router = useRouter();
const hasPublished = ref(false);
const api = useApi();
const $q = useQuasar();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

const props = defineProps({
  id: {
    type: [String, Array] as PropType<string | string[]>,
    required: false,
    default: undefined,
  },
  name: {
    type: [String, Array] as PropType<string | string[]>,
    required: false,
    default: undefined,
  },
});

const accountName = computed(() => {
  // route param can be either string | string[]
  if (Array.isArray(route.params.account)) {
    return route.params.account[0];
  }
  return route.params.account;
});

const contentId = computed(() => {
  // route query can be either string | string[]
  if (Array.isArray(props.id)) {
    return props.id[0] || undefined;
  }
  return props.id || undefined;
});

const destinationName = computed(() => {
  // route query can be either string | string[]
  if (Array.isArray(props.name)) {
    return props.name[0] || undefined;
  }
  return props.name || undefined;
});

const defaultConfig = computed(() => {
  return configurations.value.find((c) => c.configurationName === 'default');
});

onBeforeRouteLeave((_to, _from, next) => {
  if (hasPublished.value) {
    return next();
  }
  $q.dialog({
    title: 'Warning',
    message: 'You have not published yet, a destination has not been created. Are you sure you want to leave?',
    cancel: true,
  }).onOk(() => {
    console.log('OK');
    next();
  })
    .onCancel(() => {
      console.log('CANCEL');
      next(false);
    });
});

async function getConfigurations() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = await api.configurations.getAll();
    configurations.value = response.data;
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'NewDeploymentDestinationPage::getConfigurations()'));
  }
}

getConfigurations();
</script>
