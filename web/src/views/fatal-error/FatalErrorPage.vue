<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-lg">
    <h3>
      A Fatal Error Has Occurred
    </h3>
    <p class="q-my-md">
      The Posit Publisher has encountered an internal error, from which,
      it is unable to recover. Details regarding this error are listed below:
    </p>
    <h4>
      Error info:
    </h4>
    <p class="q-my-md">
      {{ msg }}
    </p>
    <p class="q-my-md">
      This error originated in {{ location }}
    </p>
    <p class="q-my-md">
      Click
      <a
        href=""
        @click="reloadApp"
      >
        here
      </a>
      to reload the application.
    </p>
    <p class="q-my-md">
      If this error persists, try restarting the agent.
    </p>
  </div>
</template>

<script setup lang="ts">

defineProps({
  msg: { type: String, required: true },
  location: { type: String, required: true },
});

const reloadApp = (() => {
  const here = window.location.href;
  window.location.href = here;
});

</script>
