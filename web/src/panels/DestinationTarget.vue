<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item>
    <template #header>
      <q-item-section avatar>
        <q-icon
          name="img:assets/images/posit-logo-only-unofficial.svg"
          size="35px"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>Destination</q-item-label>
        <q-item-label caption>
          {{ destinationTitle }}
        </q-item-label>
      </q-item-section>
    </template>

    <q-card class="bg-grey-9">
      <q-card-section>
        <div class="q-pa-md row q-col-gutter-lg">
          <div class="col-12 col-sm-6">
            <q-option-group
              v-model="destination"
              type="radio"
              :options="destinationOptions"
              dark
            >
              <template #label="opt">
                <div
                  class="q-ma-sm q-pa-sm"
                  style="border: solid; width: 300px; border-radius: 10px;"
                >
                  <q-item-label
                    class="text-h6"
                    style="text-transform: uppercase"
                  >
                    {{ opt.label }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ opt.account }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ opt.server }}
                  </q-item-label>
                </div>
              </template>
            </q-option-group>
            <div
              class="q-ma-sm q-pa-sm"
              style="border: solid; width: 300px; border-radius: 10px; margin-left: 3rem;"
            >
              add new server
            </div>
          </div>
          <div class="col-12 col-sm-6">
            <q-option-group
              v-model="deploymentMode"
              :options="deploymentModeOptions"
              type="radio"
              dark
              class="q-ma-lg"
            />
            <q-input
              v-model="title"
              outlined
              label="Title"
              dark
              class="q-ma-lg"
              clearable
            />
            <q-input
              v-model="description"
              outlined
              label="Description"
              autogrow
              dark
              class="q-ma-lg"
              clearable
              input-style="min-height: 5rem;"
            />
          </div>
        </div>

        TODO: select from previous deployments or add to existing or new targets<br>
        <br>
        User selects from a list of deployment targets:<br>
        <ul>
          <li>Update an existing deployment</li>
          <li>New deployment on an existing account</li>
          <li>Create a new account</li>
        </ul>
        <br>
        Scenarios:<br>
        <ul>
          <li>Redeployment of bundle to previous destination</li>
          <li>Modification of files include in bundle to previous destination</li>
          <li>Content type changed since last deployment</li>
          <li>New deployment of bundle w/ same settings as before but to new destination (server or account)</li>
          <li>Redeployment of bundle w/ changed settings</li>
          <li>New deployment - existing destination/account</li>
          <li>New deployment - existing destination, different account than used previously</li>
          <li>New deployment - new destination (new account)</li>
        </ul>
        <br>
        What would you like to deploy:<br>
        <ul>
          <li>defaults to previous deployment for this bundle</li>
          <li>if content type has changed, it will show as a new deployment</li>
          <li>files included by subdirectory except for exclusions</li>
        </ul>
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import type { DeploymentMode } from './deploymentModes';
import { useApi } from 'src/api';

const api = useApi();

const title = ref('');
const description = ref('');

type DeploymentModeOptions = {
  label: string,
  value: DeploymentMode,
  color: string,
};

const deploymentModeOptions: DeploymentModeOptions[] = [
  { label: 'New deployment', value: 'new_deployment', color: 'white' },
  { label: 'Re-deployment', value: 're_deployment', color: 'white' }
];

const deploymentMode = ref<DeploymentMode>('new_deployment');

const destination = ref('op1');

const destinationOptions = [
  {
    value: 'op1',
    label: 'Staging',
    account: 'bill.sager@posit.co',
    server: 'https://dogfood.posit.co',
    icon: 'restaurant_menu',
    color: 'white'
  },
  {
    value: 'op2',
    label: 'Production',
    account: 'bill.sager@posit.co',
    server: 'https://connect.posit.co',
    color: 'white'
  },
  {
    value: 'op3',
    label: 'Development',
    account: 'bill.sager@posit.co',
    server: 'https://colorado.posit.co',
    color: 'white'
  }
];

const destinationTitle = computed(() => {
  if (deploymentMode.value === 'new_deployment') {
    return `Colorado, deploying 'Quarterly Report'`;
  }
  return `Colorado, updating 'Quarterly Report'`;
});

const testAPI = async() => {
  try {
    const response = await api.accounts.getAll();
    console.log('worked', response);
  } catch (err) {
    console.log(err);
  }
};

testAPI();
</script>
