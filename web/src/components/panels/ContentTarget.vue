<!-- Copyright (C) 2023 by Posit Software, PBC. -->
<template>
  <div
    class="q-mx-md q-my-lg row justify-between"
    style="align-items: flex-start;"
  >
    <q-input
      v-model="title"
      label="Title"
      square
      outlined
      dense
      dark
      clearable
      hint="Enter a title for your content on the server"
      class="col-8"
    />
    <q-btn
      :disable="disablePublishingAction"
      class=""
      color="primary"
      label="Publish"
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

const disablePublishingAction = ref(false);

const onPublish = async() => {
  emit('publish');
  disablePublishingAction.value = true;
  try {
    await api.publish.start();
  } catch (e) {
    // Temporary until we determine the mechanism to notify users of general errors.
    console.log('An error has occurred when calling publish.start:', e);
  }
  disablePublishingAction.value = false;
};

</script>
