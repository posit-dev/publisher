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
        class="destination-logo"
      />
    </template>
    <div class="q-pa-sm">
      <q-list>
        <AccountCredential
          v-for="account in accounts"
          :key="account.name"
          v-model="deploymentStore.account"
          :account="account"
        />
      </q-list>
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherDestinationLogo from 'src/components/icons/PublisherDestinationLogo.vue';
import AccountCredential from 'src/components/configurePublish/AccountCredential.vue';

import { useDeploymentStore } from 'src/stores/deployment';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';
import { Account, useApi } from 'src/api';

const deploymentStore = useDeploymentStore();
const colorStore = useColorStore();

const destinationTitle = computed(() => {
  if (deploymentStore.account) {
    return `New deployment using ${deploymentStore.account} account`;
  }
  return '';
});

const api = useApi();
const accounts = ref(<Account[]>[]);

onMounted(async() => {
  try {
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
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

</style>
