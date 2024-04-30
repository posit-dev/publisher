<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
    <EasyDeploy class="easy-deploy-container" />
    <ProjectFiles />
    <PythonPackages />
  </main>
</template>

<script setup lang="ts">
import EasyDeploy from "src/components/EasyDeploy.vue";
import ProjectFiles from "src/components/views/ProjectFiles.vue";
import PythonPackages from "src/components/views/PythonPackages.vue";

import { useHostConduitService } from "src/HostConduitService";

useHostConduitService();
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 20px;
  margin-block-end: 1rem;
}
</style>
