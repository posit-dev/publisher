<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-header
    elevated
    class="my-class"
  >
    <q-toolbar class="max-width-md q-pa-auto">
      <AppMenu />
      <WhitePositLogo
        width="70px"
        height="30px"
        class="posit-logo"
        alt="Posit PBC Logo"
      />
      <q-toolbar-title class="q-pl-xs">
        Publisher
      </q-toolbar-title>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">

import AppMenu from 'src/components/AppMenu.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

</script>
