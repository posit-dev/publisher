<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-py-md">
    <q-breadcrumbs>
      <q-breadcrumbs-el
        label="Project"
        :to="{
          name:
            'project'
        }"
      />
      <q-breadcrumbs-el
        label="Publish Process"
      />
    </q-breadcrumbs>

    <PublishStepper class="q-mt-xl" />
  </div>
</template>

<script setup lang="ts">
import PublishStepper from 'src/views/publish-progress/PublishStepper.vue';
</script>
