<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Destination"
    :subtitle="destinationTitle"
  >
    <template #avatar>
      <PublisherDestinationLogo
        width="40px"
        height="40px"
        svg-class="destination-logo"
      />
    </template>
    <div class="q-pa-sm">
      <q-list>
        <AccountCredentials
          v-for="account in accounts"
          :key="account.name"
          v-model="selectedAccountName"
          :account="account"
          selected-class="account-item-selected"
          un-selected-class="account-item-not-selected"
        />
      </q-list>
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherDestinationLogo from 'src/components/icons/PublisherDestinationLogo.vue';
import AccountCredentials from 'src/components/configurePublish/AccountCredentials.vue';

import { useDeploymentStore } from 'src/stores/deployment';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';
import { Account, useApi } from 'src/api';
import { findAccount } from 'src/utils/accounts';

const deploymentStore = useDeploymentStore();
const colorStore = useColorStore();

const selectedAccountName = ref('');

const destinationTitle = computed(() => {
  if (selectedAccountName.value) {
    return `New deployment using ${selectedAccountName.value} account`;
  }
  return '';
});

const api = useApi();
const accounts = ref(<Account[]>[]);

onMounted(async() => {
  try {
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
    if (
      accounts.value &&
      deploymentStore.deployment &&
      deploymentStore.deployment?.target.accountName
    ) {
      const account = findAccount(deploymentStore.deployment.target.accountName, accounts.value);
      if (account) {
        selectedAccountName.value = account.name;
      } else {
        // TODO: handle the error, we do not have a match.
      }
    }
  } catch (err) {
    // TODO: handle the error
  }
});
</script>

<style>
.destination-logo {
  fill: v-bind('colorToHex(colorStore.activePallete.icon.fill)');
  stroke: v-bind('colorToHex(colorStore.activePallete.icon.stroke)');
}

.account-item-selected {
  border: v-bind('colorToHex(colorStore.activePallete.destination.outline)') solid 2px;
  border-radius: 10px;
  background-color: v-bind('colorToHex(colorStore.activePallete.destination.background.selected)');
  color: v-bind('colorToHex(colorStore.activePallete.destination.text)');
}

.account-item-not-selected {
  border: v-bind('colorToHex(colorStore.activePallete.destination.outline)') solid 1px;
  border-radius: 10px;
  background-color: v-bind('colorToHex(colorStore.activePallete.destination.background.unSelected)');
  color: v-bind('colorToHex(colorStore.activePallete.destination.text)');
}

.account-caption {
  color: v-bind('colorToHex(colorStore.activePallete.destination.caption)');
}

.account-url {
  color: v-bind('colorToHex(colorStore.activePallete.destination.caption)');
}

.account-credential {
  color: v-bind('colorToHex(colorStore.activePallete.destination.caption)');
  font-size: x-small;
  text-align: end;
}
</style>
