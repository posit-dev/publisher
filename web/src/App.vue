<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const api = useApi();
const deploymentStore = useDeploymentStore();

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

const handleQueryParams = async() => {
  // router is async so we wait for it to be ready
  await router.isReady();

  // Enable debug logging output only when we've got this query flag
  // example: http://127.0.0.1:9000/#/?debug
  // note: will not work if initial URL is http://127.0.0.1:9000/?debug
  //       as it becomes http://127.0.0.1:9000/?debug=true#/
  if ('debug' in route.query) {
    console.debug = console.log.bind(window.console);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.debug = function(){};
  }
  // This will only output a debug console message if we received the query flag.
  console.debug('Debug output messages are active!');
};

onMounted(async() => {
  await handleQueryParams();
  await getInitialDeploymentState();
});

</script>
