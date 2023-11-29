<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-select
    v-model="selectedAccount"
    outlined
    dense
    :options="matchingAccounts"
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

import { onMounted, ref, watch } from 'vue';

import { Account, useApi } from 'src/api';

const api = useApi();

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  url: { type: String, required: true },
  // Account Name
  modelValue: { type: String, required: true },
});

type AccountSelection = Account & {
  label: string,
  value: string,
  icon: string,
}

const matchingAccounts = ref<AccountSelection[]>([]);
const selectedAccount = ref<AccountSelection | undefined>(undefined);

const init = async() => {
  try {
    const response = await api.accounts.getAll();

    const credentials = response.data.accounts.find(
      (account: Account) => account.name === props.modelValue
    );

    if (credentials) {
      selectedAccount.value = {
        ...credentials,
        label: props.modelValue,
        value: props.modelValue,
        icon: 'key',
      };
      // Now load up our matching accounts to the URL of the selected one
      response.data.accounts.forEach((a: Account) => {
        if (selectedAccount.value && a.url === selectedAccount.value.url) {
          matchingAccounts.value.push({
            ...a,
            label: a.name,
            value: a.name,
            icon: 'key',
          });
        }
      });
    } else {
      // TODO, logic error, we did not receive a valid account name.
    }
  } catch (err) {
    // TODO: handle the API error
  }
};

watch(selectedAccount, (newValue: AccountSelection | undefined) => {
  if (newValue) {
    emit('update:modelValue', newValue.name);
  }
});

watch(
  [
    () => props.url,
    () => props.modelValue,
  ],
  () => {
    init();
  }
);

onMounted(() => {
  init();
});

</script>
