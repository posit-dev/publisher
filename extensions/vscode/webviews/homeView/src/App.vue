<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
    <EasyDeploy class="easy-deploy-container" />
    <PythonPackages />
  </main>
</template>

<script setup lang="ts">
import EasyDeploy from "./components/EasyDeploy.vue";
import PythonPackages from "./components/views/PythonPackages.vue";
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 20px;
  margin-block-end: 1rem;
}
</style>
