<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
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
      data-automation="add-new-deployment"
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Deployment, DeploymentRecordError, isDeploymentRecordError, useApi } from 'src/api';
import { ErrorMessages, buildErrorBannerMessage, newFatalErrorRouteLocation } from 'src/util/errors';
import { sortByDateString } from 'src/utils/date';
import { router } from 'src/router';
import DeploymentCard from './DeploymentCard.vue';
import PButton from 'src/components/PButton.vue';
import PCard from 'src/components/PCard.vue';
import ErrorBanner from 'src/components/ErrorBanner.vue';

const api = useApi();
const deployments = ref<Deployment[]>([]);
const errorMessages = ref<ErrorMessages>([]);

const hasDeployments = computed(() => {
  return deployments.value.length > 0;
});

const sortedDeployments = computed(() => {
  return [...deployments.value].sort((a, b) => {
    return sortByDateString(a.deployedAt, b.deployedAt);
  });
});

const dismissError = () => {
  errorMessages.value = [];
};

async function getDeployments() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = (await api.deployments.getAll()).data;
    deployments.value = response.filter<Deployment>((d): d is Deployment => {
      return !isDeploymentRecordError(d);
    });
    const deploymentErrors: DeploymentRecordError[] = response.filter(isDeploymentRecordError);
    if (deploymentErrors) {
      // We will show deployment errors on this page, while all other pages
      // route these towards the fatal error page. This is because the user
      // can see the list of deployments for their project and hopefully is
      // in a position of resolving issues.
      errorMessages.value = [];
      deploymentErrors.forEach((d) => {
        return errorMessages.value.push(
          buildErrorBannerMessage(
            d.error.msg,
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

await getDeployments();
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
</style>
