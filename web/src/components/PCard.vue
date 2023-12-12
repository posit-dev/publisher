<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div
    class="p-card focus-shadow truncate"
    :class="{ hoverable: to }"
  >
    <component
      :is="to ? RouterLink : 'div'"
      :to="to"
    >
      <span
        v-if="to"
        class="link-fill"
        aria-hidden="true"
      />

      <div class="card-header flex no-wrap items-center">
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
      </div>

      <slot />
    </component>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { RouteLocationRaw, RouterLink } from 'vue-router';

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
  }
});
</script>

<style scoped lang="scss">
.p-card {
    position: relative;
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

    .card-header {
      &:not(:last-child) {
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
    background-color: white;
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

