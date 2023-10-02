<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-page
    class="max-width-md q-mx-auto"
    padding
  >
    <DeploymentMode
      v-model="deploymentMode"
    />
    <PublishingHeader
      @publish="emit('publish')"
    />
    <q-list
      bordered
      class="rounded-borders"
    >
      <DestinationTarget
        group="configurePublish"
      />
      <q-separator />
      <FilesToPublish
        group="configurePublish"
      />
      <q-separator />
      <PythonProject
        group="configurePublish"
      />
      <q-separator />
      <!-- Common and Advanced Settings commented out until implemented. -->
      <CommonSettings
        v-if="false"
        group="configurePublish"
      />
      <q-separator
        v-if="false"
      />
      <AdvancedSettings
        v-if="false"
        group="configurePublish"
      />
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import DeploymentMode from 'src/components/configurePublish/DeploymentMode.vue';
import PublishingHeader from 'src/components/configurePublish/PublishingHeader.vue';
import DestinationTarget from 'src/components/configurePublish/DestinationTarget.vue';
import FilesToPublish from 'src/components/configurePublish/FilesToPublish.vue';
import PythonProject from 'src/components/configurePublish/PythonProject.vue';
import CommonSettings from 'src/components/configurePublish/CommonSettings.vue';
import AdvancedSettings from 'src/components/configurePublish/AdvancedSettings.vue';

import type { DeploymentModeType } from 'src/api/types/deployments.ts';

const emit = defineEmits(['publish']);

const deploymentMode = ref<DeploymentModeType>('new');

watch(deploymentMode, (newValue) => {
  console.log(`new value is ${newValue}`);
});

</script>
