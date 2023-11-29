<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row">
    <q-btn
      flat
      icon="menu"
      class="q-px-xs"
    >
      <q-menu>
        <q-list
          class="q-pa-sm"
        >
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set(true)"
          >
            <q-item-section>Dark Mode - on</q-item-section>
          </q-item>
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set(false)"
          >
            <q-item-section>Dark Mode - off</q-item-section>
          </q-item>
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set('auto')"
          >
            <q-item-section>Dark Mode - auto</q-item-section>
          </q-item>
        </q-list>
        <q-separator />
        <q-list
          class="q-pa-sm"
        >
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set(true)"
          >
            <q-item-section>
              <router-link
                :to="{ name: 'project'}"
                style="text-decoration: none; color: inherit;"
              >
                TEMP - Project Page
              </router-link>
            </q-item-section>
          </q-item>
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set(true)"
          >
            <q-item-section>
              <router-link
                :to="{ name: 'newDeployment', params: { account: 'dogfood' }}"
                style="text-decoration: none; color: inherit;"
              >
                TEMP - New Deployment
              </router-link>
            </q-item-section>
          </q-item>
          <q-item
            v-close-popup
            clickable
            class="q-my-sm"
            @click="$q.dark.set(true)"
          >
            <q-item-section>
              <router-link
                :to="{ name: 'reDeployment', params: { id: '5d9e7135-7532-4975-a30a-3e96f80f1076', account: 'dogfood' }}"
                style="text-decoration: none; color: inherit;"
              >
                TEMP - Re-Deployment
              </router-link>
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';

const $q = useQuasar();

</script>
