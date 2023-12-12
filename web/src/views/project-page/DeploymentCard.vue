<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <PCard
    :to="{ name: 'deployments', params: { id: `${deployment.saveName}` }}"
    :title="deployment.saveName"
  >
    <div class="space-between-sm">
      <p>{{ deployment.serverUrl }}</p>
      <p>{{ deployment.id }}</p>
      <PublishProgressLine
        v-if="showProgressLine"
        :id="deployment.id"
      />
      <p v-else>
        Last Published on {{ formatDateString(deployment.deployedAt) }}
      </p>
    </div>
  </PCard>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';

import { Deployment } from 'src/api';
import { formatDateString } from 'src/utils/date';
import { useEventStore } from 'src/stores/events';
import PCard from 'src/components/PCard.vue';
import PublishProgressLine from 'src/components/PublishProgressLine.vue';

const eventStore = useEventStore();

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});

const showProgressLine = computed(() => {
  return (
    eventStore.isPublishActiveByID(props.deployment.id) ||
    (
      eventStore.doesPublishStatusApply(props.deployment.id)
      &&
      eventStore.currentPublishStatus.status.completion === 'error'
    )
  );
});

</script>
