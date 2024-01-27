<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row">
    <q-btn
      no-caps
      flat
      data-automation="dark-mode-button"
      icon="menu"
      class="q-px-xs"
    >
      <q-menu>
        <q-list
          data-automation="dark-menu"
          class="q-pa-sm"
        >
          <q-item
            v-if="!vscode"
            v-close-popup
            clickable
            class="q-my-sm"
            data-automation="dark-on"
            @click="$q.dark.set(true)"
          >
            <q-item-section>Dark Mode - on</q-item-section>
          </q-item>
          <q-item
            v-if="!vscode"
            v-close-popup
            clickable
            class="q-my-sm"
            data-automation="dark-off"
            @click="$q.dark.set(false)"
          >
            <q-item-section>Dark Mode - off</q-item-section>
          </q-item>
          <q-item
            v-if="!vscode"
            v-close-popup
            clickable
            data-automation="dark-auto"
            class="q-my-sm"
            @click="$q.dark.set('auto')"
          >
            <q-item-section>Dark Mode - auto</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { vscode } from 'src/vscode';

const $q = useQuasar();

</script>
