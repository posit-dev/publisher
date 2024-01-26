<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-header>
    <q-toolbar class="publisher-layout">
      <AppMenu v-if="!vscode" />
      <q-toolbar-title>
        <PLink
          class="posit-logo-link text-white"
          :to="{ name: 'root' }"
        >
          <WhitePositLogo
            width="70px"
            height="30px"
            class="posit-logo"
            alt="Posit PBC Logo"
          />
          <span class="q-pl-xs">Publisher</span>
        </PLink>
      </q-toolbar-title>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">
import { vscode } from 'src/vscode';
import AppMenu from 'src/components/AppMenu.vue';
import PLink from 'src/components/PLink.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';
</script>

<style scoped lang="scss">
.posit-logo {
  fill: white;
  stroke: none;
}

.posit-logo-link {
  text-decoration: none;

  &.vscode-router-link {
    text-decoration: none;
  }

  & > * {
    vertical-align: middle;
  }
}

</style>
