<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-select
    v-model="selectedAccount"
    outlined
    dense
    :options="matchingAccounts"
    :read-only="disableCredential"
    label="Credential"
  >
    <template #option="scope">
      <q-item v-bind="scope.itemProps">
        <q-item-section avatar>
          <q-icon :name="scope.opt.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ scope.opt.label }}
          </q-item-label>
          <q-item-label caption>
            from: {{ scope.opt.source }}
          </q-item-label>
          <q-item-label caption>
            using: {{ scope.opt.authType }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup lang="ts">

import { computed, onMounted, ref, watch } from 'vue';

import { Account, useApi } from 'src/api';

const api = useApi();

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  url: { type: String, required: true },
  modelValue: { type: String, required: true },
});

type AccountSelection = Account & {
  label: string,
  value: string,
}

const matchingAccounts = ref<AccountSelection[]>([]);
const selectedAccount = ref<AccountSelection | undefined>(undefined);

watch(selectedAccount, (newValue: AccountSelection | undefined) => {
  if (newValue) {
    emit('update:modelValue', newValue.name);
  }
});

onMounted(async() => {
  try {
    const response = await api.accounts.getAll();
    response.data.accounts.forEach((account: Account) => {
      const accountSelect = {
        ...account,
        label: `${account.name}`,
        value: account.name,
        icon: '"key',
      };
      matchingAccounts.value.push(accountSelect);
      if (account.name === props.modelValue) {
        selectedAccount.value = accountSelect;
      }
    });
  } catch (err) {
    // TODO: handle the error
  }
});

const disableCredential = computed(() => {
  if (matchingAccounts.value.length > 1) {
    return false;
  }
  return true;
});
</script>
