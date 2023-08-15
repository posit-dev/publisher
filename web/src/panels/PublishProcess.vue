<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="q-mt-sm fit row wrap justify-end items-start content-start">
    <q-btn
      :disable="disablePublishingAction"
      class="q-mt-sm q-ml-sm"
      color="primary"
      label="Publish"
      @click="onPublish"
    />
  </div>
</template>

<script setup>

import { ref } from 'vue';
import { useApi } from 'src/api';

const api = useApi();

const disablePublishingAction = ref(false);

const onPublish = async() => {
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
