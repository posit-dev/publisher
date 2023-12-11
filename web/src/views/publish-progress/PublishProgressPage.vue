<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-page
    class="max-width-md q-mx-auto"
    padding
  >
    <q-breadcrumbs>
      <q-breadcrumbs-el
        label="Project"
        :to="{
          name:
            'project'
        }"
      />
      <q-breadcrumbs-el
        label="deployment url goes here"
      />
      <q-breadcrumbs-el
        label="Publish Process"
      />
    </q-breadcrumbs>
    <div class="q-mt-lg">
      <!-- <PublishSummary /> -->
      <PublishStepper />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import PublishStepper from 'src/views/publish-progress/PublishStepper.vue';
</script>
