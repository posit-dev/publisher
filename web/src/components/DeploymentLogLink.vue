<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div v-if="showLinks">
    <PLink v-if="summarizedLogLink" :to="summarizedLogLink">
      View summarized deployment logs
    </PLink>
    <a v-else :href="connectLogLink" target="_blank" rel="noopener noreferrer">
      View deployment logs on Connect
    </a>
  </div>
</template>

<script setup lang="ts">
import {
  Deployment,
  DeploymentError,
  PreDeployment,
  isDeployment,
  isDeploymentError,
} from "src/api";
import { useEventStore } from "src/stores/events";
import { PropType, computed } from "vue";

import PLink from "src/components/PLink.vue";
import { RouteLocationRaw } from "vue-router";

const events = useEventStore();

const props = defineProps({
  deployment: {
    type: Object as PropType<Deployment | PreDeployment | DeploymentError>,
    required: true,
  },
});

const showLinks = computed(() => {
  return summarizedLogLink.value || connectLogLink.value;
});

const summarizedLogLink = computed((): RouteLocationRaw | undefined => {
  if (
    !events.doesPublishStatusApplyToDeployment(props.deployment.deploymentName)
  ) {
    return undefined;
  }
  if (isDeploymentError(props.deployment)) {
    return undefined;
  }
  return {
    name: "progress",
    params: {
      name: props.deployment.deploymentName,
    },
  };
});

const connectLogLink = computed(() => {
  if (!isDeployment(props.deployment)) {
    return undefined;
  }
  return `${props.deployment.dashboardUrl}/logs`;
});
</script>
