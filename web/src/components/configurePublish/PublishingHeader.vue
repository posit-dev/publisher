<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    class="q-my-lg row justify-between"
    style="align-items: flex-start;"
  >
    <q-input
      v-model="title"
      label="Title"
      outlined
      dense
      dark
      clearable
      hint="Enter a title for your content on the server"
      class="col-9"
    />
    <q-btn
      color="primary"
      label="Publish"
      padding="8px 30px"
      class="q-ml-xs"
      @click="onPublish"
    />
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue';
import { useApi } from 'src/api';

const emit = defineEmits(['publish']);

const api = useApi();
const title = ref('');

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
