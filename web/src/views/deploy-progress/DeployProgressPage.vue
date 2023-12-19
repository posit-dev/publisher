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

    <DeployStepper class="q-mt-xl" />
  </div>
</template>

<script setup lang="ts">
import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';
</script>
