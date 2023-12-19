<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl">
    <q-breadcrumbs>
      <q-breadcrumbs-el
        label="Project"
        :to="{
          name:
            'project'
        }"
      />
      <q-breadcrumbs-el
        label="Deploy Progress"
      />
    </q-breadcrumbs>

    <div
      class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
    >
      <div class="space-between-sm">
        <h1
          v-if="name"
          class="text-h6"
        >
          {{ name }}
        </h1>
        <p>
          {{ operation }}
        </p>
        <p v-if="id">
          {{ id }}
        </p>
      </div>
    </div>

    <DeployStepper class="q-mt-xl" />
  </div>
</template>

<script setup lang="ts">
import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';

defineProps({
  name: { type: String, required: true },
  operation: { type: String, required: true },
  id: { type: String, required: false, default: '' },
});
</script>
