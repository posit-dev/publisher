<!-- Copyright (C) 2023 by Posit Software, PBC. -->
<template>
  <LayoutPanel
    title="Describe what you are publishing"
    icon="img:assets/images/settings.png"
    :default-open="true"
    expand-icon="none"
  >
    <div
      style="background-color: black"
    >
      <div
        class="q-pa-sm row"
      >
        <q-input
          v-model="title"
          square
          dark
          label="Title"
          placeholder="Enter a title for your content on the server"
          class="full-width"
        />
      </div>
      <div
        class="q-pa-sm q-py-md"
      >
        <div class="row">
          <div class="q-py-sm q-pr-md">
            Mode:
          </div>
          <q-chip
            v-model:selected="deploymentMode.new"
            @click="onNewDeployment"
            class="col"
          >
            Create a new deployment
          </q-chip>
          <q-chip
            v-model:selected="deploymentMode.redeployment"
            @click="onReDeployment"
            class="col"
          >
            Replace the existing deployment
          </q-chip>
        </div>
      </div>
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';

import LayoutPanel from 'components/LayoutPanel.vue';

const deploymentMode = reactive({
  new: false,
  redeployment: true,
});
const title = ref('');

const onNewDeployment = () => {
  console.log('onNew!');
  deploymentMode.redeployment = false;
};
const onReDeployment = () => {
  console.log('onReDeployment!');
  deploymentMode.new = false;
};

</script>
