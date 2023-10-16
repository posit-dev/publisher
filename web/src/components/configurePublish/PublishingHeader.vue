<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    class="q-my-lg row justify-between items-start"
  >
    <q-input
      v-model="title"
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
import { computed } from 'vue';

const emit = defineEmits(['publish']);

const api = useApi();
const deploymentStore = useDeploymentStore();

// Unable to use storeToRefs from pinia because deployment is not
// always defined. We might want to revisit this and instead define it
// initially with an empty definition.
const title = computed({
  get() {
    if (deploymentStore.deployment) {
      return deploymentStore.deployment.connect.content.title;
    }
    return '';
  },
  set(val) {
    if (deploymentStore.deployment) {
      deploymentStore.deployment.connect.content.title = val;
    } else {
      console.log('Error setting title into empty deployment object!');
    }
  }
});

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
