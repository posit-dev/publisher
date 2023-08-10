<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="q-mt-sm fit row wrap justify-end items-start content-start">
    <q-btn
      :disable="disabled"
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

const disabled = ref(false);

function onPublish() {
  disabled.value = true;
  api.publish.initiatePublish();
}

</script>
