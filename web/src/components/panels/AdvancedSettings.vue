<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Advanced Settings"
    subtitle="Vanity URL, Tags and Environment Vars set"
    icon="img:images/settings.png"
  >
    <div class="q-ma-md">
      Set values for these settings to maximize your control over the deployment and 
      runtime of your project.
    </div>
    <q-input
      v-model="vanityURL"
      label="Vanity URL"
      square
      outlined
      dense
      dark
      clearable
      hint="Configure a custom path on the server to access your project."
      class="q-ma-md"
    />
    <q-input
      v-model="tags"
      label="Tags"
      square
      outlined
      dense
      dark
      clearable
      hint="Associate organizational tags with your project"
      class="q-ma-md"
      type="textarea"
    />
    <q-input
      v-model="environmentVars"
      label="Environmental Variables"
      square
      outlined
      dense
      dark
      clearable
      hint="Set values for environment variables to be made available to your project at runtime"
      class="q-ma-md"
      type="textarea"
    />
    <q-input
      v-model="defaultImageName"
      label="Default Image Name (OHE Only)"
      square
      outlined
      dense
      dark
      clearable
      hint="Set an optional default image name for your Off-Host Execution configuration."
      class="q-ma-md"
    />
    <q-checkbox v-model="publishWithoutRender" label="Publish without Render (documents only)" dark />
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/LayoutPanel.vue';

import { ref } from 'vue';

const publishWithoutRender = ref(false);
const defaultImageName = ref('');
const environmentVars = ref('YEAR=2023\nSKEPTICISM=HIGH\nPRECISION=HIGH\nCACHE=NO');
const tags = ref('USA\nPNW\nBigfood\nSasquatch\nShiny');
const vanityURL = ref('/my-project');

</script>
