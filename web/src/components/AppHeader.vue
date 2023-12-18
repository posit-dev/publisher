<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-header>
    <q-toolbar class="publisher-layout">
      <AppMenu />
      <q-toolbar-title>
        <router-link
          class="posit-logo-link"
          :to="{ name: 'root' }"
        >
          <WhitePositLogo
            width="70px"
            height="30px"
            class="posit-logo"
            alt="Posit PBC Logo"
          />
          <span class="q-pl-xs">Publisher</span>
        </router-link>
      </q-toolbar-title>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">

import AppMenu from 'src/components/AppMenu.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

</script>

<style scoped lang="scss">
.posit-logo {
  fill: white;
  stroke: none;
}

.posit-logo-link {
  text-decoration: none;
  color: white;

  & > * {
    vertical-align: middle;
  }
}

</style>
