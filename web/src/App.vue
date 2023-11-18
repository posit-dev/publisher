<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div id="app">
    <q-layout
      view="hHh lpR fFf"
    >
      <AppHeader />

      <q-page-container>
        <!-- route outlet -->
        <!-- component matched by the route will render here -->
        <router-view />
      </q-page-container>
    </q-layout>
  </div>
</template>

<script setup lang="ts">

import { useQuasar } from 'quasar';

import AppHeader from 'src/components/AppHeader.vue';

const $q = useQuasar();
$q.dark.set('auto');

</script>

<style lang="scss">
// Add colors to Quasar Palette (white and black)
.text-white {
  color: white !important;
}
.bg-white {
  background: white !important;
}
.text-black {
  color: black !important;
}
.bg-black {
  background: black !important;
}
</style>
