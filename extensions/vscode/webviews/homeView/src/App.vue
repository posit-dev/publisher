<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
    <EvenEasierDeploy class="easy-deploy-container" />
    <EasyDeploy class="easy-deploy-container" />
    <ProjectFiles v-model:expanded="projectFilesExpanded" />
    <PythonPackages />
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

import EvenEasierDeploy from "src/components/EvenEasierDeploy.vue";
import EasyDeploy from "src/components/EasyDeploy.vue";
import ProjectFiles from "src/components/views/ProjectFiles.vue";
import PythonPackages from "src/components/views/PythonPackages.vue";

import { useHostConduitService } from "src/HostConduitService";

useHostConduitService();

const projectFilesExpanded = ref(true);
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 20px;
  margin-block-end: 1rem;
}
</style>
