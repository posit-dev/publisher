<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="deployment-card focus-shadow">
    <RouterLink :to="`/deployments/${deployment.id}`">
      <span
        class="link-fill"
        aria-hidden="true"
      />

      <p class="card-title">
        {{ deployment.saveName }}
      </p>
      <div class="card-details">
        <p>{{ deployment.serverUrl }}</p>
        <p>{{ deployment.id }}</p>
        <p>Last Published on {{ formatDateString(deployment.deployedAt) }}</p>
      </div>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { RouterLink } from 'vue-router';

import { Deployment } from 'src/api';
import { formatDateString } from 'src/utils/date';

defineProps({
  deployment: {
    type: Object as PropType<Deployment>,
    required: true,
  },
});
</script>

<style scoped lang="scss">
.deployment-card {
    position: relative;
    align-items: center;
    border-radius: 8px;
    border: 1px solid;
    padding: 24px;

    a {
      color: inherit;
      text-decoration: none;

      &:focus {
        outline: 2px solid transparent;
        outline-offset: 2px;
      }

      .link-fill {
        position: absolute;
        inset: 0px;
      }
    }

    .card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .card-details {
      margin-top: 12px;

      & > :not([hidden]) ~ :not([hidden]) {
        margin-top: 8px;
      }
    }

    p {
      margin: unset;
      padding: unset;
    }
}

.body--light {
  .deployment-card {
    background-color: white;
    border-color: $grey-4;

    &:hover {
      border-color: $grey-6;
    }
  }
}

.body--dark {
  .deployment-card {
    border-color: $grey-8;

    &:hover {
      border-color: $grey-6;
    }
  }
}
</style>
