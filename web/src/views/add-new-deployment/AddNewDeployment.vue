<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl">
    <q-breadcrumbs>
      <q-breadcrumbs-el
        label="Project"
        :to="{ name: 'project' }"
      />
      <q-breadcrumbs-el label="New Deployment" />
    </q-breadcrumbs>

    <q-form
      class="q-gutter-md"
      @reset="resetForm"
      @submit.prevent="navigateToNewDeploymentPage"
    >
      <div class="q-pa-sm">
        <q-list>
          <AccountRadio
            v-for="account in accounts"
            :key="account.name"
            v-model="selectedAccountName"
            :account="account"
          />
        </q-list>
      </div>
      <q-input
        v-model="deploymentName"
        label="Deployment Name"
        hint="Required, used locally to identify this deployment."
        :error="Boolean(deploymentNameError)"
        :error-message="deploymentNameError"
        clearable
      />
      <div class="flex row reverse">
        <PButton
          hierarchy="primary"
          :disable="disableToDeploymentPage"
          data-automation="continue-deployment"
          type="submit"
        >
          Continue to Deploy
        </PButton>
        <PButton
          hierarchy="secondary"
          class="q-mr-sm"
          type="reset"
          @click="router.back()"
        >
          Cancel
        </PButton>
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { Account, useApi } from 'src/api';
import { computed, ref } from 'vue';
import { RouteLocationRaw, useRouter } from 'vue-router';
import { Deployment, isDeploymentRecordError } from 'src/api/types/deployments';

import AccountRadio from 'src/views/add-new-deployment/AccountRadio.vue';
import { newFatalErrorRouteLocation } from 'src/util/errors';
import PButton from 'src/components/PButton.vue';

const accounts = ref<Account[]>([]);
const selectedAccountName = ref<string>('');
const deploymentName = ref<string>('');
const deployments = ref<Deployment[]>([]);

const api = useApi();
const router = useRouter();

async function getAccounts() {
  try {
    // 200 - success
    // 500 - internal server error
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
    if (accounts.value.length > 0) {
      // select the first one
      selectedAccountName.value = accounts.value[0].name;
    }
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'AddNewDeployment::getAccounts()'));
  }
}

async function getDeployments() {
  try {
    // API Returns:
    // 200 - success
    // 500 - internal server error
    const response = (await api.deployments.getAll()).data;
    deployments.value = response.filter<Deployment>((d): d is Deployment => {
      return !isDeploymentRecordError(d);
    });
  } catch (error: unknown) {
    router.push(newFatalErrorRouteLocation(error, 'ProjectPage::getDeployments()'));
  }
}

const deploymentNameError = computed(() => {
  if (!deploymentName.value) {
    return 'A unique deployment name must be provided.';
  }
  if (deployments.value.find((deployment) => deployment.saveName === deploymentName.value)) {
    return 'Deployment name already in use. Please supply a unique name.';
  }
  return undefined;
});

function resetForm() {
  selectedAccountName.value = '';
  deploymentName.value = '';
}

const deploymentPage = computed<RouteLocationRaw>(() => ({
  name: 'newDeployment',
  params: {
    account: selectedAccountName.value,
  },
  query: {
    name: deploymentName.value || undefined,
  }
}));

const disableToDeploymentPage = computed(() => {
  return Boolean(!selectedAccountName.value || deploymentNameError.value);
});

function navigateToNewDeploymentPage() {
  router.push(deploymentPage.value);
}

const generateDefaultName = () => {
  let id = 0;
  let defaultName = '';
  do {
    id += 1;
    const trialName = `Untitled-${id}`;
    if (!deployments.value.find((deployment) => deployment.saveName === trialName)) {
      defaultName = trialName;
    }
  } while (!defaultName);
  return defaultName;
};

const init = async() => {
  getAccounts();
  await getDeployments();
  deploymentName.value = generateDefaultName();
};
init();

</script>
