<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-header>
    <q-toolbar class="publisher-layout">
      <AppMenu />
      <router-link
        :to="{ name: 'root' }"
        class="header row"
      >
        <WhitePositLogo
          width="70px"
          height="30px"
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <q-toolbar-title class="q-pl-xs">
          Publishing Assistant
        </q-toolbar-title>
      </router-link>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">

import AppMenu from 'src/components/AppMenu.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

</script>

<style lang="scss">

.posit-logo {
  fill: white;
  stroke: none;
  cursor: pointer;
}

.header {
  text-decoration: none;
  color: white;
}

</style>
