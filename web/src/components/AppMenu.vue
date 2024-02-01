<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="row">
    <q-btn
      no-caps
      flat
      data-automation="menu-button"
      icon="menu"
      class="q-px-xs"
    >
      <q-menu>
        <q-list class="q-pa-sm">
          <q-item
            v-close-popup
            :clickable="clickable"
            :to="toProject"
            data-automation="nav-project"
            class="q-my-sm"
            @click="onClickProject"
          >
            <q-item-section>Project View</q-item-section>
          </q-item>
          <q-item
            v-close-popup
            :clickable="clickable"
            :to="toAgentLog"
            data-automation="nav-agentLog"
            class="q-my-sm"
            @click="onClickAgentLog"
          >
            <q-item-section>View Agent Log</q-item-section>
          </q-item>
          <q-separator />
          <template v-if="!vscode">
            <q-item
              clickable
              data-automation="dark-mode-submenu"
            >
              <q-item-section>Set Dark Mode</q-item-section>
              <q-item-section side>
                <q-icon name="keyboard_arrow_right" />
              </q-item-section>
              <q-menu
                anchor="top end"
                self="top start"
              >
                <q-list>
                  <q-item
                    v-close-popup
                    clickable
                    class="q-my-sm"
                    data-automation="dark-on"
                    @click="$q.dark.set(true)"
                  >
                    <q-item-section>to On</q-item-section>
                  </q-item>
                  <q-item
                    v-close-popup
                    clickable
                    class="q-my-sm"
                    data-automation="dark-off"
                    @click="$q.dark.set(false)"
                  >
                    <q-item-section>to Off</q-item-section>
                  </q-item>
                  <q-item
                    v-close-popup
                    clickable
                    data-automation="dark-auto"
                    class="q-my-sm"
                    @click="$q.dark.set('auto')"
                  >
                    <q-item-section>to Auto</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-item>
            <q-separator />
          </template>
          <q-item class="q-my-sm">
            <q-item-section>Version {{ version }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { vscode } from 'src/vscode';
import { router } from 'src/router';
import { computed } from 'vue';

const $q = useQuasar();

const version = __VERSION__;

const onClickProject = () => {
  if (vscode) {
    return router.push({ name: 'project' });
  }
  return undefined;
};

const toProject = computed(() => {
  if (!vscode) {
    return { name: 'project' };
  }
  return undefined;
});

const onClickAgentLog = () => {
  if (vscode) {
    return router.push({ name: 'agentLog' });
  }
  return undefined;
};

const toAgentLog = computed(() => {
  if (!vscode) {
    return { name: 'agentLog' };
  }
  return undefined;
});

const clickable = computed(() => {
  return Boolean(vscode);
});

</script>
