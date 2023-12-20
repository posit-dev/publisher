<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-stepper
    v-model="openStep"
    vertical
    animated
    flat
    :header-nav="true"
  >
    <CreateNewDeployment
      :name="1"
      @start="openStep = 1"
    />
    <CreateBundle
      :name="2"
      @start="openStep = 2"
    />
    <UploadBundle
      :name="3"
      @start="openStep = 3"
    />
    <CreateDeployment
      :name="4"
      @start="openStep = 4"
    />
    <SetEnvVars
      :name="5"
      @start="openStep = 5"
    />
    <DeployBundle
      :name="6"
      @start="openStep = 6"
    />
    <RestorePythonEnvironment
      :name="7"
      @start="openStep = 7"
    />
    <RunContent
      :name="9"
      @start="openStep = 9"
      @done="openStep = 10"
    />
    <WrappingUpDeployment
      :name="10"
    />
  </q-stepper>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import {
  CreateDeployment,
  SetEnvVars,
  CreateBundle,
  UploadBundle,
  DeployBundle,
  RestorePythonEnvironment,
  RunContent,
  WrappingUpDeployment,
  CreateNewDeployment,
} from 'src/views/deploy-progress/steps';

const openStep = ref<number | undefined>(undefined);

</script>
src/views/deploy-progress/steps
