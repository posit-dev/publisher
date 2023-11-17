<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div id="app">
    <h1>Hello App!</h1>
    <!-- route outlet -->
    <!-- component matched by the route will render here -->
    <router-view />
  </div>
</template>

<script setup lang="ts">

import { useQuasar } from 'quasar';

const $q = useQuasar();
$q.dark.set('auto');

</script>

