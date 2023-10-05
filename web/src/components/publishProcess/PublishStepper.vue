<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-stepper
    v-model="openStep"
    vertical
    animated
    flat
    :header-nav="true"
  >
    <CreateDeployment :name="1" />
    <CreateBundle :name="2" />
    <UploadBundle :name="3" />
    <DeployBundle :name="4" />
    <RestorePythonEnvironment :name="5" />
    <RunContent :name="6" />
    <WrappingUpDeployment :name="7" />
  </q-stepper>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import {
  CreateDeployment,
  CreateBundle,
  UploadBundle,
  DeployBundle,
  RestorePythonEnvironment,
  RunContent,
  WrappingUpDeployment
} from 'src/components/publishProcess/steps';

const openStep = ref<number | undefined>(undefined);
</script>

