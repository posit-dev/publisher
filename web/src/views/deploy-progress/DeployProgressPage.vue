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
        label="Deploy"
        class="click-target"
        @click="router.go(-1)"
      />
      <q-breadcrumbs-el
        label="Progress"
      />
    </q-breadcrumbs>

    <div
      class="flex justify-between q-mt-md row-gap-lg column-gap-xl"
    >
      <div class="space-between-sm">
        <h1
          v-if="saveName"
          class="text-h6"
        >
          {{ saveName }}
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
import { computed } from 'vue';
import { useEventStore } from 'src/stores/events';
import { useRouter } from 'vue-router';

import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';

const eventStore = useEventStore();
const router = useRouter();

const saveName = computed(() => {
  return eventStore.currentPublishStatus.saveName;
});

const operation = computed(() => {
  return `Deploying to: ${eventStore.currentPublishStatus.destinationURL}`;
});

const id = computed(() => {
  return eventStore.currentPublishStatus.contentId;
});
// defineProps({
//   name: { type: String, required: true },
//   operation: { type: String, required: true },
//   id: { type: String, required: false, default: '' },
// });
</script>

<style scoped lang="scss">
.click-target {
  cursor: pointer;
}
</style>
