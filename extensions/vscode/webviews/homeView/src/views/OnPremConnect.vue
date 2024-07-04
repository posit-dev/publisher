<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <EvenEasierDeploy class="easy-deploy-container" />
  <template v-if="home.selectedConfiguration">
    <ProjectFiles v-model:expanded="projectFilesExpanded" />
    <PythonPackages />
    <RPackages />
  </template>
</template>

<script setup lang="ts">
import { ref } from "vue";

import EvenEasierDeploy from "src/components/EvenEasierDeploy.vue";
import ProjectFiles from "src/components/views/ProjectFiles.vue";
import PythonPackages from "src/components/views/PythonPackages.vue";
import RPackages from "src/components/views/RPackages.vue";

import { useHomeStore } from "../stores/home";

const home = useHomeStore();
const projectFilesExpanded = ref(false);
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 0;
  margin-block-end: 1rem;
}
</style>
