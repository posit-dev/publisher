<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    class="q-my-lg row justify-between items-start"
  >
    <q-input
      v-model="deploymentStore.title"
      :color="colorStore.activePallete.textInput.active"
      label="Title"
      outlined
      dense
      clearable
      hint="Enter a title for your content on the server"
      class="col-9"
    />
    <q-btn
      color="primary"
      label="Publish"
      padding="8px 30px"
      class="q-ml-xs"
      no-caps
      @click="onPublish"
    />
  </div>
</template>

<script setup lang="ts">

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { useColorStore } from 'src/stores/color';

const colorStore = useColorStore();

const emit = defineEmits(['publish']);

const api = useApi();
const deploymentStore = useDeploymentStore();

const onPublish = async() => {
  emit('publish');
  try {
    await api.publish.start();
  } catch (e) {
    // Temporary until we determine the mechanism to notify users of general errors.
    console.log('An error has occurred when calling publish.start:', e);
  }
};
</script>
