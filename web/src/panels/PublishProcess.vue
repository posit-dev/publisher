<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="q-mt-sm fit row wrap justify-end items-start content-start">
    <q-btn
      class="q-mt-sm q-ml-sm"
      color="primary"
      label="Publish"
    />
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>Open Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.openEvents"
      :key="ndx"
    >
      {{ msg.type }} @ {{ msg.time }}: {{ msg.data }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>All Error Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.errorEvents"
      :key="ndx"
    >
      {{ msg.type }} @ {{ msg.time }}: {{ msg.data }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>All Message Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.dataEvents"
      :key="ndx"
    >
      {{ msg.type }} @ {{ msg.time }}: {{ msg.data }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>All Log Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.logEvents"
      :key="ndx"
    >
      {{ msg.type }} @ {{ msg.time }}: {{ msg.data }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>Unknown/Unhandled Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.unknownEvents"
      :key="ndx"
    >
      {{ msg.type }} @ {{ msg.time }}: {{ msg.data }}
    </p>
  </div>
</template>

<script setup>
import { useEventStore } from 'src/stores/events';

// setup our event store which will receive server side events
const eventStore = useEventStore();

</script>
