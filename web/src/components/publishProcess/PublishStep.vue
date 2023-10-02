<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-step
    :name="name"
    title="This is a step"
    :icon="icon"
    :active-icon="icon"
    :header-nav="true"
  >
    <div class="text-bold">
      {{ summary }}
    </div>
    <q-list
      dense
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

