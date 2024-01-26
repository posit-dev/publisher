<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-stepper
    v-model="openStep"
    vertical
    animated
    flat
    :header-nav="true"
  >
    <CheckCapabilities
      :name="1"
      @start="openStep = 1"
    />
    <CreateNewDeployment
      :name="2"
      @start="openStep = 2"
    />
    <CreateBundle
      :name="3"
      @start="openStep = 3"
    />
    <UploadBundle
      :name="4"
      @start="openStep = 4"
    />
    <CreateDeployment
      :name="5"
      @start="openStep = 5"
    />
    <SetEnvVars
      :name="6"
      @start="openStep = 6"
    />
    <DeployBundle
      :name="7"
      @start="openStep = 7"
    />
    <RestorePythonEnvironment
      :name="8"
      @start="openStep = 8"
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
  CheckCapabilities,
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
