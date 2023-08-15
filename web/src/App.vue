<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <router-view />
</template>

<script setup lang="ts">
import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';

const api = useApi();
const deploymentStore = useDeploymentStore();

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

getInitialDeploymentState();
</script>
