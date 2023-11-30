<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-select
    v-model="selectedAccount"
    outlined
    dense
    :options="options"
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

import { PropType, computed, ref, watch } from 'vue';

import { Account } from 'src/api';

const emit = defineEmits(['change']);
const props = defineProps({
  url: { type: String, required: true },
  accounts: { type: Object as PropType<Account[]>, required: true },
});

type AccountSelection = Account & {
  label: string,
  value: string,
  icon: string,
}

const selectedAccount = ref<AccountSelection | undefined>(undefined);

const options = computed(() => {
  const newOptions = <AccountSelection[]>[];

  props.accounts.forEach((account: Account) => {
    newOptions.push({
      ...account,
      label: account.name,
      value: account.name,
      icon: 'key',
    });
  });
  return newOptions;
});

watch(
  options,
  () => {
    if (!options.value.find((option) => option.label === selectedAccount.value?.label)) {
      if (options.value.length > 0) {
        selectedAccount.value = options.value[0];
      } else {
        selectedAccount.value = undefined;
      }
    }
  },
  { immediate: true }
);

watch(
  selectedAccount,
  () => {
    emit('change', selectedAccount.value);
  }
);

</script>
