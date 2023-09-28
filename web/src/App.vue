<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-layout
    view="hHh lpR fFf"
    class="bg-grey-9 text-white"
  >
    <q-header
      elevated
      class="bg-primary text-white"
    >
      <q-toolbar class="max-width-md q-pa-auto">
        <AppMenu />
        <WhitePositLogo
          width="70px"
          height="30px"
          fill="white"
          stroke="none"
          class="posit-logo"
          alt="Posit PBC Logo"
        />
        <q-toolbar-title class="q-pl-xs">
          Publisher
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <ConfigurePublish
        v-if="currentView === 'configure'"
        @publish="onPublish"
      />
      <PublishProcess
        v-if="currentView === 'publish'"
        :events="allEvents"
        :event-stream="eventStream"
        @back="onConfigure"
      />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">

import { onBeforeUnmount, ref } from 'vue';

import AppMenu from 'src/components/AppMenu.vue';
import ConfigurePublish from 'src/components/configurePublish/ConfigurePublish.vue';
import PublishProcess from 'src/components/publishProcess/PublishProcess.vue';
import WhitePositLogo from 'src/components/icons/WhitePositLogo.vue';

import { useApi } from 'src/api';
import { useDeploymentStore } from 'src/stores/deployment';
import { EventStream } from 'src/api/resources/EventStream';
import { EventStreamMessage } from 'src/api/types/events';

type viewType = 'configure' | 'publish';

const currentView = ref<viewType>('configure');
const api = useApi();
const deploymentStore = useDeploymentStore();

const eventStream = new EventStream();
// Temporary storage of events
const allEvents = ref<EventStreamMessage[]>([]);

const onPublish = () => {
  currentView.value = 'publish';
};
const onConfigure = () => {
  currentView.value = 'configure';
};

const getInitialDeploymentState = async() => {
  const { data: deployment } = await api.deployment.get();
  deploymentStore.deployment = deployment;
};

const incomingEvent = (msg: EventStreamMessage) => {
  allEvents.value.push(msg);
};
eventStream.addEventMonitorCallback(['*'], incomingEvent);

eventStream.setDebugMode(true);
eventStream.open('/api/events?stream=messages');
console.log(eventStream.status());

// Have to be sure to close connection or it will be leaked on agent (if it continues to run)
onBeforeUnmount(() => {
  eventStream.close();
});

getInitialDeploymentState();
</script>
