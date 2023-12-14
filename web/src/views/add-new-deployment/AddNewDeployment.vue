<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-pt-md q-pb-xl">
    <q-breadcrumbs>
      <q-breadcrumbs-el
        label="Project"
        :to="{ name: 'project' }"
      />
      <q-breadcrumbs-el label="New Destination" />
    </q-breadcrumbs>

    <q-form
      class="q-gutter-md"
      @reset="resetForm"
      @submit.prevent="navigateToNewDestinationPage"
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
        hint="Optional"
      />
      <q-input
        v-model="contentId"
        label="Content ID"
        hint="Optional"
      />
      <div class="flex row reverse">
        <q-btn
          no-caps
          unelevated
          :to="destinationPage"
          :disable="disableToDestinationPage"
          type="submit"
          :color="$q.dark.isActive ? 'grey-1' : 'grey-10'"
          :text-color="$q.dark.isActive ? 'black' : 'white'"
          label="Continue to Publish"
        />
        <q-btn
          no-caps
          unelevated
          type="reset"
          outline
          class="q-mr-sm"
          label="Cancel"
          @click="router.back()"
        />
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { Account, useApi } from 'src/api';
import { computed, ref } from 'vue';
import { RouteLocationRaw, useRouter } from 'vue-router';

import AccountRadio from 'src/views/add-new-deployment/AccountRadio.vue';

const accounts = ref<Account[]>([]);
const selectedAccountName = ref<string>('');
const deploymentName = ref<string>('');
const contentId = ref<string>('');

const api = useApi();
const router = useRouter();

async function getAccounts() {
  const response = await api.accounts.getAll();
  accounts.value = response.data.accounts;
}

function resetForm() {
  selectedAccountName.value = '';
  contentId.value = '';
  deploymentName.value = '';
}

const destinationPage = computed<RouteLocationRaw>(() => ({
  name: 'newDeployment',
  params: {
    account: selectedAccountName.value,
  },
  query: {
    id: contentId.value || undefined,
    name: deploymentName.value || undefined,
  }
}));

const disableToDestinationPage = computed(() => {
  return Boolean(!selectedAccountName.value);
});

function navigateToNewDestinationPage() {
  router.push(destinationPage.value);
}

getAccounts();
</script>
