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
        hint="Optional, used locally to identify this deployment."
        clearable
      />
      <div class="flex row reverse">
        <PButton
          hierarchy="primary"
          :disable="disableToDeploymentPage"
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
import { computed, ref, watch } from 'vue';
import { RouteLocationRaw, useRouter } from 'vue-router';

import AccountRadio from 'src/views/add-new-deployment/AccountRadio.vue';
import { newFatalErrorRouteLocation } from 'src/util/errors';
import PButton from 'src/components/PButton.vue';

const accounts = ref<Account[]>([]);
const selectedAccountName = ref<string>('');
const deploymentName = ref<string>('');
const lastDefaultName = ref<string>('');

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
  return Boolean(!selectedAccountName.value);
});

function navigateToNewDeploymentPage() {
  router.push(deploymentPage.value);
}

const generateDefaultName = (accountName: string) => {
  return `Deployment using ${accountName}`;
};

watch(
  () => selectedAccountName.value,
  (newVal, oldVal) => {
    let update = false;
    if (
      oldVal &&
      lastDefaultName.value === generateDefaultName(oldVal) &&
      deploymentName.value === lastDefaultName.value
    ) {
      // ok to update it, the value is still our last generated default
      update = true;
    } else if (!oldVal && !deploymentName.value) {
      // ok to update, the field is blank and we have never had a default
      update = true;
    }
    if (update) {
      lastDefaultName.value = generateDefaultName(newVal);
      deploymentName.value = lastDefaultName.value;
    }
  }
);

getAccounts();
</script>
