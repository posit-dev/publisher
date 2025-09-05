<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <main>
    <OverlayableView :activateOverlay="home.showDisabledOverlay">
      <EvenEasierDeploy class="easy-deploy-container" />
      <template
        v-if="
          home.selectedConfiguration &&
          !isConfigurationError(home.selectedConfiguration)
        "
      >
        <ProjectFiles v-model:expanded="projectFilesExpanded" />
        <Secrets />
        <IntegrationRequests v-if="!home.isConnectCloud" />
        <PythonPackages />
        <RPackages />
      </template>
      <Credentials />
      <HelpAndFeedback />
    </OverlayableView>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

import OverlayableView from "src/components/OverlayableView.vue";
import EvenEasierDeploy from "src/components/EvenEasierDeploy.vue";
import ProjectFiles from "src/components/views/projectFiles/ProjectFiles.vue";
import Secrets from "src/components/views/secrets/Secrets.vue";
import IntegrationRequests from "src/components/views/IntegrationRequests.vue";
import PythonPackages from "src/components/views/PythonPackages.vue";
import RPackages from "src/components/views/RPackages.vue";
import Credentials from "src/components/views/Credentials.vue";
import HelpAndFeedback from "src/components/views/HelpAndFeedback.vue";

import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "./stores/home";
import { isConfigurationError } from "../../../src/api";

useHostConduitService();

const home = useHomeStore();

const projectFilesExpanded = ref(true);
</script>

<style lang="scss" scoped>
.easy-deploy-container {
  padding: 0 20px;
  margin-block-end: 1rem;
}
</style>
