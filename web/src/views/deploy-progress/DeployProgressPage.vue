<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl">
    <q-breadcrumbs>
      <q-breadcrumbs-el>
        <PLink :to="{ name: 'project' }">
          Project
        </PLink>
      </q-breadcrumbs-el>
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
      <div class="space-between-y-sm">
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
import { computed } from 'vue';
import { useEventStore } from 'src/stores/events';
import { useRouter } from 'vue-router';

import DeployStepper from 'src/views/deploy-progress/DeployStepper.vue';
import PLink from 'src/components/PLink.vue';

const eventStore = useEventStore();
const router = useRouter();

const id = computed(() => {
  return eventStore.currentPublishStatus.contentId;
});

defineProps({
  name: {
    type: String,
    required: true,
  },
  operation: {
    type: String,
    required: true,
  },
  // Temp until we figure out how to make this work right
  // id: {
  //   type: String,
  //   required: true,
  // },
});
</script>

<style scoped lang="scss">
.click-target {
  cursor: pointer;
}
</style>
