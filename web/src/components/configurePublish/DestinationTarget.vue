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
        <q-item
          v-for="account in accounts"
          :key="account.name"
          tag="label"
          class="q-my-sm row items-center account-item"
        >
          <q-item-section
            avatar
            top
            class="col-1"
          >
            <q-radio
              v-model="accountName"
              :val="account.name"
              :color="colorStore.activePallete.bullet"
            />
          </q-item-section>
          <q-item-section
            class="q-ml-md"
          >
            <q-item-label>
              {{ account.name }}
            </q-item-label>
            <q-item-label
              caption
              class="account-caption"
            >
              Account: {{ calculateName(account) }}
            </q-item-label>
            <q-item-label
              caption
              class="account-url"
            >
              URL: {{ account.url }}
            </q-item-label>
            <q-item-label
              caption
              class="q-pt-sm account-credential"
            >
              Credentials managed by: {{ account.source }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import LayoutPanel from 'src/components/configurePublish/LayoutPanel.vue';
import PublisherDestinationLogo from 'src/components/icons/PublisherDestinationLogo.vue';

import { useDeploymentStore } from 'src/stores/deployment';
import { useColorStore } from 'src/stores/color';
import { colorToHex } from 'src/utils/colorValues';
import { Account, useApi } from 'src/api';

const deploymentStore = useDeploymentStore();
const colorStore = useColorStore();

const accountName = ref('');

const destinationTitle = computed(() => {
  if (accountName.value) {
    return `New deployment on ${accountName.value}`;
  }
  return '';
});

const api = useApi();
const accounts = ref(<Account[]>[]);

onMounted(async() => {
  try {
    const response = await api.accounts.getAll();
    accounts.value = response.data.accounts;
    if (deploymentStore.deployment) {
      accountName.value = deploymentStore.deployment.target.accountName;
    }
  } catch (err) {
    // TODO: handle the error
  }
});

const calculateName = (account: Account) => {
  if (account.authType === 'token-key') {
    return account.accountName;
  } else if (account.authType === 'api-key') {
    return 'Using API Key';
  }
  return '';
};
</script>

<style>
.destination-logo {
  fill: v-bind('colorToHex(colorStore.activePallete.icon.fill)');
  stroke: v-bind('colorToHex(colorStore.activePallete.icon.stroke)');
}

.account-item {
  border: v-bind('colorToHex(colorStore.activePallete.destination.outline)') solid 2px;
  border-radius: 10px;
  background-color: v-bind('colorToHex(colorStore.activePallete.destination.background)');
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
