<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
    <OverlayableView :activateOverlay="home.showDisabledOverlay">
      <EvenEasierDeploy class="easy-deploy-container" />
      <template v-if="home.selectedConfiguration">
        <ProjectFiles v-model:expanded="projectFilesExpanded" />
        <PythonPackages />
        <RPackages />
      </template>
    </OverlayableView>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

import OverlayableView from "src/components/OverlayableView.vue";
import EvenEasierDeploy from "src/components/EvenEasierDeploy.vue";
import ProjectFiles from "src/components/views/projectFiles/ProjectFiles.vue";
import PythonPackages from "src/components/views/PythonPackages.vue";
import RPackages from "src/components/views/RPackages.vue";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "./stores/home";

useHostConduitService();

const home = useHomeStore();

const projectFilesExpanded = ref(false);
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 20px;
  margin-block-end: 1rem;
}
</style>
