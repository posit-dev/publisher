<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="lhh LpR lff"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="max-width-md q-mx-auto">
        <div
          style=""
          class="text-white row"
        >
          <q-btn flat @click="menu = !menu" dense icon="menu">
            <q-menu dark>
              <q-list style="min-width: 100px">
                <q-item clickable v-close-popup>
                  <q-item-section>Overview</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="showDebug = !showDebug">
                  <q-item-section>{{ !showDebug ? "Show Debug Console" : "Hide Debug Console" }} </q-item-section>
                </q-item>
                <q-separator dark/>
                <q-item clickable v-close-popup>
                  <q-item-section>About</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <q-toolbar-title>
          Posit Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="showDebug"
      side="right"
      bordered
      :width="drawerWidth"
      dark
      :overlay="overlayMode"
    >
      <q-toolbar class="bg-orange shadow-2 rounded-borders">
        <div class="q-pa-sm col">
          DEBUG
        </div>
        <q-space />
        <q-btn-toggle
          v-model="debugModel"
          push
          flat
          outline
          no-caps
          toggle-color="primary"
          :options="[
            {label: 'Agent', value: 'agent'},
            {label: 'Events', value: 'events'},
            {label: 'Diagnostics', value: 'diagnostics'}
          ]"
        />
        <q-btn icon="close" flat @click="showDebug = false"></q-btn>
      </q-toolbar>
      <q-scroll-area class="fit" >
        <div class="q-pa-sm">
          <div v-for="n in 50" :key="n" dark>{{ debugModel }} log: drawer {{ n }} / 50</div>
        </div>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        class="max-width-md q-mx-auto"
        padding
      >
        <q-tabs
          v-model="tab"
          dense
          class="text-grey"
          active-color="white"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="newDeployment" label="New Deployment" dark />
          <q-tab name="updateDeployment" label="Update Existing Deployment" dark />
        </q-tabs>
        <q-separator />

        <q-tab-panels v-model="tab" animated dark>
          <q-tab-panel name="newDeployment">
            <div class="q-mx-md q-mb-md">
              Your project will be published to the Posit Connect server as a new deployment.
              Update the information below and then click the Publish button to begin the process.
            </div>
            <q-list
              dark
              class="rounded-borders"
            >
              <ContentTarget />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator dark class="q-mx-md"/>
              <DestinationTarget />
              <q-separator dark class="q-mx-md" />
              <FilesToPublish />
              <q-separator dark class="q-mx-md" />
              <PythonProject />
              <q-separator dark class="q-mx-md" />
              <CommonSettings />
              <q-separator dark class="q-mx-md" />
              <AdvancedSettings />
              <q-separator dark class="q-mx-md" />
            </q-list>
          </q-tab-panel>

          <q-tab-panel name="updateDeployment">
            <div class="q-mx-md q-mb-md">
              Your project will be published to the Posit Connect server as an update to the existing
              instance of this deployment. Update the information below and then click the Publish
              button to begin the process.
            </div>
            <q-list
              dark
              class="rounded-borders"
            >
              <ContentTarget />
              <div class="q-mx-md q-mt-xl q-mb-sm">
                Customize your deployment on the server by expanding any of the sections below.
              </div>
              <q-separator dark class="q-mx-md"/>
              <DestinationTarget />
              <q-separator dark class="q-mx-md" />
              <FilesToPublish />
              <q-separator dark class="q-mx-md" />
              <PythonProject />
              <q-separator dark class="q-mx-md" />
              <CommonSettings />
              <q-separator dark class="q-mx-md" />
              <AdvancedSettings />
              <q-separator dark class="q-mx-md" />
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import ContentTarget from '../panels/ContentTarget.vue';
import DestinationTarget from '../panels/DestinationTarget.vue';
import FilesToPublish from '../panels/FilesToPublish.vue';
import PythonProject from '../panels/PythonProject.vue';
import CommonSettings from '../panels/CommonSettings.vue';
import AdvancedSettings from '../panels/AdvancedSettings.vue';
import PublishProcess from '../panels/PublishProcess.vue';

import { ref, onMounted, onUnmounted, computed } from 'vue'

const tab = ref('newDeployment');
const menu = ref(false);
const showDebug = ref(false);
const debugModel = ref('one');

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// if width < 848, use overlay mode
const overlayMode = computed(() => {
  return windowWidth.value < 848;
});

const drawerWidth = computed(() => {
  if (overlayMode.value) {
    return 400;
  }
  return windowWidth.value / 2;
});

</script>

<style lang="scss">
.posit-logo {
  max-height: 26px;
  width: auto;
}
</style>
