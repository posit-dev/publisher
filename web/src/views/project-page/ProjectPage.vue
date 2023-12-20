<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl space-between-lg">
    <q-breadcrumbs>
      <q-breadcrumbs-el label="Project" />
    </q-breadcrumbs>

    <div class="flex items-center justify-between">
      <div class="col">
        <h2 class="text-h6">
          Deployments
        </h2>
        <p
          v-if="hasDeployments"
          class="q-mt-xs"
        >
          Your project has been deployed to:
        </p>
      </div>

      <PButton
        v-if="hasDeployments"
        hierarchy="primary"
        :to="{ name: 'addNewDeployment' }"
      >
        New Deployment
      </PButton>
    </div>

    <ErrorBanner
      :error-messages="errorMessages"
      @dismiss="dismissError"
    />
    <div
      v-if="hasDeployments"
      class="card-grid"
    >
      <DeploymentCard
        v-for="deployment in sortedDeployments"
        :key="deployment.id"
        :deployment="deployment"
      />
    </div>
    <div v-else>
      <PCard
        :to="{ name: 'addNewDeployment' }"
      >
        <div class="flex column items-center">
          <q-icon
            name="add"
            size="2rem"
          />
          <h3 class="text-body1 text-weight-medium q-mt-sm">
            Add a New Deployment
          </h3>
          <p class="q-mt-xs text-low-contrast">
            This project hasn't been deployed yet.
          </p>
          <p class="text-low-contrast">
            Get started by adding a new deployment.
          </p>
        </div>
      </PCard>
    </div>

    <div>
      <h2 class="text-h6">
        Configurations
      </h2>
      <p class="q-mt-xs">
        The configuration file(s) available for this project, which specify the settings applied during
        deployments.
      </p>
      <p class="q-mt-xs">
        NOTE: Edit these files to add or modify settings which will be applied during this project's
        next deployment.
      </p>
    </div>
    <div class="config-grid">
      <ConfigCard
        v-for="config in configurations"
        :key="config.configurationName"
        :config="config"
      />
    </div>

    <div>
      <h2 class="text-h6">
        Files
      </h2>
      <p class="q-mt-xs">
        The files detected for this project. Unless ignored,
        these files will be uploaded to the server each time you deploy this project.
      </p>
      <p class="q-mt-xs">
        NOTE: A <span class="text-bold">.positignore</span> file can be used to indicate which files should
        not be included in your deployments to the server.
      </p>
    </div>
    <FileTree />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useApi } from 'src/api';
import { Deployment, DeploymentError, isDeploymentError } from 'src/api/types/deployments';
import { Configuration, ConfigurationError } from 'src/api/types/configurations';
import { useRouter } from 'vue-router';
import { ErrorMessages, buildErrorBannerMessage, newFatalErrorRouteLocation } from 'src/util/errors';

import ConfigCard from './ConfigCard.vue';
import DeploymentCard from './DeploymentCard.vue';
import FileTree from 'src/components/FileTree.vue';
import PButton from 'src/components/PButton.vue';
import PCard from 'src/components/PCard.vue';
import ErrorBanner from 'src/components/ErrorBanner.vue';
import { sortByDateString } from 'src/utils/date';

const api = useApi();
const router = useRouter();
const deployments = ref<Deployment[]>([]);
const configurations = ref<Array<Configuration | ConfigurationError>>([]);
const errorMessages = ref<ErrorMessages>([]);

const hasDeployments = computed(() => {
  return deployments.value.length > 0;
});

const dismissError = () => {
  errorMessages.value = [];
};

const sortedDeployments = computed(() => {
  return [...deployments.value].sort((a, b) => {
    return sortByDateString(a.deployedAt, b.deployedAt);
  });
});

async function getDeployments() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = (await api.deployments.getAll()).data;
    deployments.value = response.filter<Deployment>((d): d is Deployment => {
      return !isDeploymentError(d);
    });
    const deploymentErrors: DeploymentError[] = response.filter(isDeploymentError);
    if (deploymentErrors) {
      // We will show deployment errors on this page, while all other pages
      // route these towards the fatal error page. This is because the user
      // can see the list of deployments for their project and hopefully is
      // in a position of resolving issues.
      errorMessages.value = [];
      deploymentErrors.forEach((d) => {
        return errorMessages.value.push(
          buildErrorBannerMessage(
            d.error,
            `Please correct errors within the indicated deployment file(s).
            The files will not appear on the list below until they are valid and
            you have reloaded this page.`,
          ),
        );
      });
    }
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'ProjectPage::getDeployments()'));
  }
}

async function getConfigurations() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = await api.configurations.getAll();
    configurations.value = response.data;
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'ProjectPage::getConfigurations()'));
  }
}

getDeployments();
getConfigurations();
</script>

<style scoped lang="scss">
.card-grid {
  display: grid;
  grid-gap: 28px;
  grid-template-columns: repeat(2, 1fr);
}

@media (max-width: 800px) {
  .card-grid {
    grid-template-columns: repeat(1, 1fr);
  }
}

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
