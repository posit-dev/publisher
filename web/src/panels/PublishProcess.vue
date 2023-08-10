<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="q-mt-sm fit row wrap justify-end items-start content-start">
    <q-btn
      class="q-mt-sm q-ml-sm"
      color="primary"
      label="Publish"
    />
    <div class="q-mt-sm q-ml-sm">
      <h4>Open Events</h4>
      <p
        v-for="(evt, ndx) in eventStore.openEvents"
        :key="ndx"
      >
        {{ evt.data.msg }}
      </p>


    </div>
    <q-infinite-scroll @load="onLoad" :offset="250">
      <div v-for="(item, index) in items" :key="index" class="caption">
        <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum repellendus sit voluptate voluptas eveniet porro. Rerum blanditiis perferendis totam, ea at omnis vel numquam exercitationem aut, natus minima, porro labore.</p>
      </div>
      <template v-slot:loading>
        <div class="row justify-center q-my-md">
          <q-spinner-dots color="primary" size="40px" />
        </div>
      </template>
    </q-infinite-scroll>
  </div>
</template>

<script setup>
import { useEventStore } from 'src/stores/events';

// setup our event store which will receive server side events
const eventStore = useEventStore();

</script>
