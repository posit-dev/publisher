<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-stepper
    v-model="activeStep"
    vertical
    animated
    dark
    flat
    class="bg-grey-9"
    :header-nav="true"
  >
    <PublishStep
      :name="1"
      icon="create_new_folder"
      summary="Registering the deployment object with the Posit Connect Server."
      :logs="[
        'Create Deployment',
        'Loading rsconnect accounts from /Users/billsager/Library/Preferences/org.R-project.R/R/rsconnect',
        'Loading rsconnect-python accounts from /Users/billsager/Library/Application Support/rsconnect-python/servers.json'
      ]"
    />
    <PublishStep
      :name="2"
      icon="create_new_folder"
      summary="Registering the deployment object with the Posit Connect Server."
      :logs="[
        'Create Deployment',
        'Loading rsconnect accounts from /Users/billsager/Library/Preferences/org.R-project.R/R/rsconnect',
        'Loading rsconnect-python accounts from /Users/billsager/Library/Application Support/rsconnect-python/servers.json'
      ]"
    />
  </q-stepper>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import PublishStep from './PublishStep.vue';

const activeStep = ref(2);
</script>

