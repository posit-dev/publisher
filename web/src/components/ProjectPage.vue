<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <h1>Project Page</h1>

  <h2>Destinations</h2>
  <ul
    v-for="deployment in deployments"
    :key="deployment.id"
  >
    <li>
      <RouterLink :to="`/deployments/${deployment.id}`">
        {{ deployment.serverUrl }}
      </RouterLink>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

import { useApi } from 'src/api';
import { Deployment, isDeploymentError } from 'src/api/types/deployments';

const api = useApi();
const deployments = ref<Deployment[]>([]);

async function getDeployments() {
  const response = (await api.deployments.getAll()).data;
  deployments.value = response.filter<Deployment>((d): d is Deployment => {
    return !isDeploymentError(d);
  });
}

getDeployments();
</script>
