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
      v-for="(evt, ndx) in eventStore.openEvents"
      :key="ndx"
    >
      {{ evt.data }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>Open Error Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.errorEvents"
      :key="ndx"
    >
      {{ msg }}
    </p>
  </div>
  <div class="column q-mt-sm q-ml-sm">
    <h4>Message Events</h4>
    <p
      v-for="(msg, ndx) in eventStore.dataEvents"
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
