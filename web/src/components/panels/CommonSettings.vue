<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel title="Common Settings" subtitle="Name and Description are set" icon="img:images/info.png">
    <div class="q-ma-md">
      It is common to set values for these settings.
    </div>

    <q-input v-if="props.redeploy" v-model="contentID" label="Content ID" square outlined dense dark clearable
      hint="Specify the target content ID to be updated" class="q-ma-md" />
    <q-input v-model="contentName" label="Name" square outlined dense dark clearable
      hint="Name your project (different from providing a title)." class="q-ma-md" />
    <q-input v-model="contentDesc" label="Description" square outlined dense dark clearable
      hint="Provide a description to better help viewers understand your project." type="textarea" class="q-ma-md" />
    <q-input v-model="bogusFile" @update:model-value="updateValue" filled type="file"
      hint="Provide a graphic file to be used as a project thumbnail." dark class="q-ma-md" />
  </LayoutPanel>
</template>

<script setup lang="ts">

import LayoutPanel from 'src/components/LayoutPanel.vue';

import { ref } from 'vue';

const props = defineProps({
  redeploy: { type: Boolean, required: true }
});

const contentDesc = ref('This project provides a shiny app which will allow the viewer to visualize the reported Sasquatch sightings in the Pacific Northwest in relationship to the environmental conditions and reliability of the witnesses.');
const contentName = ref('Research Project 2023-05-188-FG-2');
const thumbnailImage = ref(null);
const bogusFile = ref(null);
const contentID = ref('fc82dde5-c4ba-4748-971b-aacc09613faa');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateValue = (values: any[number]) => {
  if (values) {
    thumbnailImage.value = values[0];
  }
}
</script>
