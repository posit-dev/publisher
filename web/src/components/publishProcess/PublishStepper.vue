<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-stepper
    v-model="openStep"
    vertical
    animated
    flat
    :header-nav="true"
  >
    <CreateBundle
      :name="1"
      @start="openStep = 1"
    />
    <CreateDeployment
      :name="2"
      @start="openStep = 2"
    />
    <UploadBundle
      :name="3"
      @start="openStep = 3"
    />
    <DeployBundle
      :name="4"
      @start="openStep = 4"
    />
    <RestorePythonEnvironment
      :name="5"
      @start="openStep = 5"
    />
    <RunContent
      :name="6"
      @start="openStep = 6"
    />
    <WrappingUpDeployment
      :name="7"
      @start="openStep = 7"
    />
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

