<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="lhh LpR lff"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="">
        <WhitePositLogo
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <q-toolbar-title>
          Publisher
        </q-toolbar-title>
        <div
          style=""
          class="text-white row justify-content"
        >
          <q-btn
            flat
            icon="menu"
            @click="menu = !menu"
            dark
          >
            <q-menu dark max-height="400px">
              <q-list style="min-width: 100px" class="q-pa-sm">
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
                  @click="showDebug = !showDebug"
                >
                  <q-item-section>{{ !showDebug ? "Show Debug Console" : "Hide Debug Console" }} </q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>Create Diagnostic Bundle</q-item-section>
                </q-item>
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                  @click="clearEventStore"
                >
                  <q-item-section>Clear Event Store</q-item-section>
                </q-item>
                <q-separator dark />
                <q-item
                  v-close-popup
                  clickable
                  class="q-my-sm"
                >
                  <q-item-section>About</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="showDebug"
      side="right"
      :bordered="true"
      :width="800"
      dark
      :overlay="false"
    >
      <q-toolbar class="bg-orange justify-between text-black">
        <q-btn-toggle
          v-model="debugModel"
          push
          flat
          outline
          no-caps
          toggle-color="primary"
          :options="[
            {label: 'Agent', value: 'agent'},
            {label: 'Events', value: 'events'},
            {label: 'Progress Logs', value: 'progress'},
            {label: 'Unhandled', value: 'unhandled'},
            {label: 'Errors', value: 'errors'}
          ]"
        />
        <q-btn
          icon="close"
          flat
          @click="showDebug = false"
        />
      </q-toolbar>
      <q-scroll-area class="fit" style="max-height: 90%">
        <div
          v-if="debugModel === 'agent'"
          class="q-pa-sm"
        >
          <div
            v-for="(logMsg, ndx) in eventStore.agentLog"
            :key="ndx"
            dark
          >
            <div
              v-for="key in Object.keys(logMsg)"
              :key="key+ndx"
              dark
            >
              <span style="font-weight: bold; color: green;">{{ key }}:</span> {{ logMsg[key] }}
            </div>
            <p />
          </div>
          <p ref="agentLogEnd"> &nbsp; </p>
        </div>
        <div
          v-if="debugModel === 'events'"
          class="q-pa-sm"
        >
          <div
            v-for="(logMsg, ndx) in eventStore.progressEvents"
            :key="ndx"
            dark
          >
            <div
              v-for="key in Object.keys(logMsg)"
              :key="key+ndx"
              dark
            >
              <div v-if="key === 'data'">
                <div
                  v-for="subkey in Object.keys(logMsg.data)"
                  :key="'data'+subkey+ndx"
                  dark
                >
                  <span style="font-weight: bold; color: green;">{{ subkey }}:</span> {{ logMsg.data[subkey] }}
                </div>
              </div>
              <div v-if="key != 'data'">
                <span style="font-weight: bold; color: green;">{{ key }}:</span> {{ logMsg[key] }}
              </div>
            </div>
            <p />
          </div>
        </div>
        <div
          v-if="debugModel === 'progress'"
          class="q-pa-sm"
        >
          <div
            v-for="(logMsg, ndx) in eventStore.progressLog"
            :key="ndx"
            dark
          >
            <div
              v-for="key in Object.keys(logMsg)"
              :key="key+ndx"
              dark
            >
              <span style="font-weight: bold; color: green;">{{ key }}:</span> {{ logMsg[key] }}
            </div>
            <p />
          </div>
        </div>
        <div
          v-if="debugModel === 'unhandled'"
          class="q-pa-sm"
        >
          <div
            v-for="(logMsg, ndx) in eventStore.unknownEvents"
            :key="ndx"
            dark
          >
            <div
              v-for="key in Object.keys(logMsg)"
              :key="key+ndx"
              dark
            >
              <span style="font-weight: bold; color: green;">{{ key }}:</span> {{ logMsg[key] }}
            </div>
            <p />
          </div>
        </div>
        <div
          v-if="debugModel === 'errors'"
          class="q-pa-sm"
        >
          <div
            v-for="(logMsg, ndx) in eventStore.errorEvents"
            :key="ndx"
            dark
          >
            <div
              v-for="key in Object.keys(logMsg)"
              :key="key+ndx"
              dark
            >
              <span style="font-weight: bold; color: green;">{{ key }}:</span> {{ logMsg[key] }}
            </div>
            <p />
          </div>
        </div>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page
        class="max-width-md q-mx-auto"
        padding
      >
        <h6 class="q-mt-none q-mb-md">
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
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import DestinationTarget from 'src/components/panels/DestinationTarget.vue';
import FilesToPublish from 'src/components/panels/FilesToPublish.vue';
import PythonProject from 'src/components/panels/PythonProject.vue';
import CommonSettings from 'src/components/panels/CommonSettings.vue';
import AdvancedSettings from 'src/components/panels/AdvancedSettings.vue';
import PublishProcess from 'src/components/PublishProcess.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { useEventStore } from 'src/stores/events';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { scroll as qScroll } from 'quasar';
const { getScrollTarget, setVerticalScrollPosition } = qScroll;

const api = useApi();
const deploymentStore = useDeploymentStore();

// setup our event store which will receive server side events
const eventStore = useEventStore();
eventStore.enableConnectionDebugMode();
eventStore.initConnection('/api/events?stream=messages');
console.log(eventStore.getConnectionStatus());

const menu = ref(false);
const showDebug = ref(false);
const debugModel = ref('agent');

const agentLogEnd = ref(null);

const clearEventStore = () => {
  eventStore.clearStore();
};

// Have to be sure to close connection or it will be leaked on agent (if it continues to run)
onBeforeUnmount(() => {
  eventStore.closeConnection();
});

// const agentLogLength = computed(() => {
//   return eventStore.agentLog.values.length;
// });

// watch(agentLogLength, () => {
//   if (agentLogEnd.value) {
//     const el = agentLogEnd.value;
//     const target = getScrollTarget(el);
//     const offset = el.offsetTop;
//     const duration = 0;
//     setVerticalScrollPosition(target, offset, duration);
//   }
// });
let lastAgentLogLength = -1;
onMounted(() => {
  setInterval(() => {
    if (agentLogEnd.value && lastAgentLogLength !== eventStore.agentLog.length) {
      lastAgentLogLength = eventStore.agentLog.length;
      const el = agentLogEnd.value;
      const target = getScrollTarget(el);
      const offset = el.offsetTop;
      const duration = 1000;
      setVerticalScrollPosition(target, offset, duration);
    }
  }, 1000);
});

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

getInitialDeploymentState();
</script>

<style lang="scss" scoped>
.posit-logo {
  max-height: 26px;
  width: auto;
}
</style>
