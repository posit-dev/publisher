<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="text-white row">
    <q-btn
      flat
      icon="menu"

      class="q-px-xs"
      @click="menu = !menu"
    >
      <q-menu
        dark
      >
        <!-- <q-list
          style="min-width: 100px"
          class="q-pa-sm"
        >
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
          >
            <q-item-section>Overview</q-item-section>
          </q-item>

          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
          >
            <q-item-section>Posit Publishing FAQs</q-item-section>
          </q-item>

          <q-separator dark />

          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
          >
            <q-item-section>Show Agent Console</q-item-section>
          </q-item>

          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
          >
            <q-item-section>Create Diagnostic Bundle</q-item-section>
          </q-item>

          <q-separator dark />

          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
          >
            <q-item-section>About</q-item-section>
          </q-item>
        </q-list> -->
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const menu = ref(false);

</script>
