<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-form
    class="q-gutter-md"
    @reset="resetForm"
    @submit.prevent="addDestination"
  >
    <div class="q-pa-sm">
      <q-list>
        <AccountRadio
          v-for="account in accounts"
          :key="account.name"
          v-model="selectedAccount"
          :account="account"
        />
      </q-list>
    </div>

    <q-input
      v-model="contentId"
      label="Content ID"
      hint="Optional"
    />

    <div class="flex row reverse">
      <q-btn
        type="submit"
        color="primary"
        label="Add"
      />
      <q-btn
        type="reset"
        class="q-mr-sm"
        label="Cancel"
        @click="router.back()"
      />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { Account, useApi } from 'src/api';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import AccountRadio from 'src/views/add-new-deployment/AccountRadio.vue';

const accounts = ref<Account[]>([]);
const selectedAccount = ref<Account | undefined>(undefined);
const contentId = ref<string>('');

const api = useApi();
const router = useRouter();

async function getAccounts() {
  const response = await api.accounts.getAll();
  accounts.value = response.data.accounts;
}

function resetForm() {
  selectedAccount.value = undefined;
  contentId.value = '';
}

function addDestination() {
  console.log('Destination added');
}

getAccounts();
</script>

  <style scoped>
  .dialog-width {
    width: 500px;
    max-width: 90vw;
  }
  </style>

