<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-y-lg">
    <q-breadcrumbs>
      <q-breadcrumbs-el label="Project" />
    </q-breadcrumbs>

    <Suspense>
      <DeploymentsSection />

      <template #fallback>
        <div>
          <h2 class="text-h6">Deployments</h2>

          <div class="q-my-xl flex column items-center">
            <q-spinner color="primary" size="3em" />
            <span class="q-mt-md">Loading your deployments...</span>
          </div>
        </div>
      </template>
    </Suspense>

    <div>
      <h2 class="text-h6">Configurations</h2>
      <p class="q-mt-xs">
        The configuration file(s) available for this project, which specify the
        settings applied during deployments.
      </p>
      <p class="q-mt-xs">
        NOTE: Edit these files to add or modify settings which will be applied
        during this project's next deployment.
      </p>
    </div>
    <div class="config-grid">
      <ConfigCard
        v-for="config in configurations"
        :key="config.configurationName"
        :config="config"
        data-automation="config-card"
      />
    </div>

    <div>
      <h2 class="text-h6">Files</h2>
      <p class="q-mt-xs">
        The files detected for this project. Unless ignored, these files will be
        uploaded to the server each time you deploy this project.
      </p>
    </div>
    <FileTree data-automation="file-tree" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { useApi } from "src/api";
import {
  Configuration,
  ConfigurationError,
} from "src/api/types/configurations";
import { useRouter } from "vue-router";

import { newFatalErrorRouteLocation } from "src/utils/errors";
import ConfigCard from "./ConfigCard.vue";
import FileTree from "src/components/FileTree.vue";
import DeploymentsSection from "./DeploymentsSection.vue";

const api = useApi();
const router = useRouter();

const configurations = ref<Array<Configuration | ConfigurationError>>([]);

async function getConfigurations() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = await api.configurations.getAll();
    configurations.value = response.data;
  } catch (error: unknown) {
    router.push(
      newFatalErrorRouteLocation(error, "ProjectPage::getConfigurations()"),
    );
  }
}

getConfigurations();
</script>

<style scoped lang="scss">
.config-grid {
  display: grid;
  grid-gap: 28px;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 800px) {
  .config-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
