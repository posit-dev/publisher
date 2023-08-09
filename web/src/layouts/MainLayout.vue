<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="hHh lpR fFf"
    class="q-pa-md bg-grey-9 text-white"
    style="max-width: 800px"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
        <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <q-toolbar-title>
          Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <h6 style="margin-top: 0rem; margin-bottom: 1rem;">
          What would you like to be published and how?
        </h6>
        <q-list
          dark
          bordered
          class="rounded-borders"
        >
          <DestinationTarget />
          <q-separator />
          <FilesToPublish />
          <q-separator />
          <PythonProject />
          <q-separator />
          <CommonSettings />
          <q-separator />
          <AdvancedSettings />
        </q-list>
        <PublishProcess />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">

import DestinationTarget from '../panels/DestinationTarget.vue';
import FilesToPublish from '../panels/FilesToPublish.vue';
import PythonProject from '../panels/PythonProject.vue';
import CommonSettings from '../panels/CommonSettings.vue';
import AdvancedSettings from '../panels/AdvancedSettings.vue';
import PublishProcess from '../panels/PublishProcess.vue';

import WhitePositLogo from 'components/WhitePositLogo.vue';
</script>

<style lang="scss">
.posit-logo {
  max-height: 26px;
  width: auto;
}
</style>
