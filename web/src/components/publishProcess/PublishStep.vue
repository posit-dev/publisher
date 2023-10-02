<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-step
    :name="name"
    title="This is a step"
    :icon="icon"
    :active-icon="icon"
    color="grey-5"
    active-color="light-blue-3"
    done-color="white"
    :header-nav="true"
  >
    <div class="text-bold">
      {{ summary }}
    </div>
    <q-list
      dark
      dense
      class="bg-grey-10"
    >
      <q-item
        v-for="(log, index) in logs"
        :key="index"
      >
        {{ log }}
      </q-item>
    </q-list>
  </q-step>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

defineProps({
  name: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  summary: { type: String, required: true },
  logs: { type: Array as PropType<string[]>, required: false, default: () => [] }
});
</script>

