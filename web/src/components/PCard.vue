<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    class="p-card"
    :class="{ hoverable: to }"
  >
    <section class="card-header flex justify-between">
      <div class="flex items-center no-wrap">
        <q-icon
          v-if="icon"
          :name="icon"
          size="20px"
          class="q-mr-sm"
        />

        <h3
          v-if="title"
          class="card-title truncate"
        >
          {{ title }}
        </h3>

        <q-tooltip
          v-if="titleTooltip"
          class="text-body2"
          anchor="top left"
          self="bottom middle"
          max-width="300px"
          :offset="[0, 10]"
        >
          {{ titleTooltip }}
        </q-tooltip>
      </div>

      <q-btn
        padding="xs"
        flat
        icon="more_vert"
      />
    </section>

    <slot />

    <PLink
      v-if="to"
      class="link-fill"
      :to="to"
    />
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { RouteLocationRaw } from 'vue-router';

import PLink from 'src/components/PLink.vue';

defineProps({
  to: {
    type: Object as PropType<RouteLocationRaw>,
    default: undefined,
    required: false
  },
  title: {
    type: String,
    default: undefined,
    required: false,
  },
  icon: {
    type: String,
    default: undefined,
    required: false
  },
  titleTooltip: {
    type: String,
    default: undefined,
    required: false
  }
});
</script>

<style scoped lang="scss">
.p-card {
    position: relative;
    border-radius: 8px;
    border: 1px solid;
    padding: 24px;

    .link-fill {
      text-decoration: none;
      display: block;
      position: absolute;
      inset: 0;
      z-index: 1;
    }

    .card-header {
      &:not(:empty) {
        margin-bottom: 12px;
      }
    }

    .card-title {
      font-size: 16px;
      font-weight: 500;
      line-height: 1.5;
    }
}

.body--light {
  .p-card {
    background-color: var(--vscode-editor-background, white);
    border-color: $grey-4;

    &.hoverable:hover {
      border-color: $grey-6;
    }
  }
}

.body--dark {
  .p-card {
    border-color: $grey-8;

    &.hoverable:hover {
      border-color: $grey-6;
    }
  }
}
</style>

<style lang="scss">
.p-card a,
.p-card .vscode-router-link,
.p-card button {
  position: relative;
  z-index: 2;
}
</style>

