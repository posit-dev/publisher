<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-lg">
    <h4>
      A Fatal Error Has Occurred
    </h4>
    <p class="q-my-md">
      The Posit Publisher has encountered an unexpected error.
      Details regarding this error are listed below:
    </p>
    <h5>
      Error info:
    </h5>
    <div class="q-ma-md">
      <p
        v-if="!msg && !code && !stat && !baseURL && !method && !url"
        class="q-my-ad"
      >
        Ooops! No Specific Error Information Available!
      </p>
      <p
        v-if="msg"
        class="q-my-md"
      >
        <span class="text-bold">
          Message:
        </span>
        {{ msg }}
      </p>
      <p
        v-if="stat"
        class="q-my-md"
      >
        <span class="text-bold">
          Status:
        </span>
        {{ stat }}
      </p>
      <p
        v-if="code"
        class="q-my-md"
      >
        <span class="text-bold">
          Code:
        </span>
        {{ code }}
      </p>
      <p
        v-if="baseURL || method || url"
        class="q-my-md"
      >
        <span class="text-bold">
          API Path:
        </span>
        {{ method }} {{ baseURL }}  {{ url }}
      </p>
      <p
        if="location"
        class="q-my-md"
      >
        <span class="text-bold">
          This error originated:
        </span>
        {{ location }}
      </p>
    </div>
    <PButton
      class="q-my-md"
      hierarchy="primary"
      href="/"
      type="submit"
    >
      Reload Application
    </PButton>
    <p class="q-my-md">
      If this error persists, try restarting the agent.
    </p>
  </div>
</template>

<script setup lang="ts">

import PButton from 'src/components/PButton.vue';

defineProps({
  location: { type: String, required: true, default: undefined },
  stat: { type: String, required: false, default: undefined },
  code: { type: String, required: false, default: undefined },
  msg: { type: String, required: false, default: undefined },
  baseURL: { type: String, required: false, default: undefined },
  method: { type: String, required: false, default: undefined },
  url: { type: String, required: false, default: undefined },
});

</script>
