<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Destination"
    :subtitle="destinationTitle"
    icon="img:images/posit-logo-only-unofficial.svg"
    group="main"
  >
    <div class="row  text-grey">
      <div
        class="column q-pa-sm q-ma-sm"
        style="
          width: 300px;
          min-width: 300px;
          border-radius: 5px;
          border: darkgray solid;
          cursor: pointer;
        "
      >
        <div class="row justify-between flex-center text-white">
          <div style="font-size: larger">
            Add new destination...
          </div>
          <q-icon
            name="add_circle"
            color="grey"
            size="35px"
          />
        </div>
        <div class="row" style="font-size: small;">
          Click this box to configure a new server credential pair.
        </div>
      </div>
      <div
        class="column q-pa-sm q-ma-sm justify-between"
        style="
          width: 300px;
          min-width: 300px;
          max-width: 300px;
          border-radius: 5px;
          border: darkgray solid;
          cursor: pointer;
        "
        @click="toggleTarget"
      >
        <div class="row justify-between flex-center text-white" style="font-size: larger">
          Dogfood
          <q-checkbox left-label v-model="dogfoodSelected" label="" dark/>
        </div>
        <div class="row" style="font-size: small;">
          https://rsc.radixu.com/connect
        </div>
        <div class="row" style="font-size: small;">
          admin@posit.co
        </div>
        <div class="row justify-between items-end" style="font-size: small;">
          <div class="column">
            last used on 8/15/2023 @ 2:05pm
          </div>
          <div class="column">
            <div class="row">
              <q-icon name="sync" size="sm" />
              <q-icon name="delete_forever" size="sm" />
            </div>
          </div>
        </div>
      </div>
      <div
        class="column q-pa-sm q-ma-sm"
        style="
          width: 300px;
          min-width: 300px;
          max-width: 300px;
          border-radius: 5px;
          border: darkgray solid;
          cursor: pointer;
        "
        @click="toggleTarget"
      >
        <div class="row justify-between flex-center text-white" style="font-size: larger">
          Colorado
          <q-checkbox left-label v-model="coloradoSelected" label="" dark/>
        </div>
        <div class="row" style="font-size: small;">
          https://colorado.posit.co/connect
        </div>
        <div class="row" style="font-size: small;">
          publisher@posit.co
        </div>
        <div class="row justify-between items-end" style="font-size: small;">
          <div class="column">
            last used on 7/01/2023 @ 10:45am
          </div>
          <div class="column">
            <div class="row">
              <q-icon name="sync" size="sm" />
              <q-icon name="delete_forever" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import LayoutPanel from 'src/components/LayoutPanel.vue';
import { useDeploymentStore } from 'src/stores/deployment';

const deploymentStore = useDeploymentStore();

const destinationTitle = computed(() => {
  const accountName = deploymentStore.deployment?.target.accountName;
  if (dogfoodSelected.value) {
    return `New deployment on Dogfood`;
  } else if (coloradoSelected.value) {
    return `New deployment on Colorado`;
  } else if (accountName) {
    return `New deployment on ${accountName}`;
  }
  return '';
});

const dogfoodSelected = ref(true);
const coloradoSelected = ref(false);

const toggleTarget = () => {
  dogfoodSelected.value = !dogfoodSelected.value;
  coloradoSelected.value = !coloradoSelected.value;
};

watch(dogfoodSelected, (newValue) => {
  coloradoSelected.value = !newValue;
});

watch(coloradoSelected, (newValue) => {
  dogfoodSelected.value = !newValue;
});

</script>
