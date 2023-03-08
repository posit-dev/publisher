<!-- Copyright (C) 2023 by Posit Software, PBC. -->
<template>
  <v-list flat>
    <v-toolbar elevation="1" class="pr-0">
      <v-toolbar-title>Publishing Accounts</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-plus" size="small" rounded="large" color="indigo" @click="addAccount">
      </v-btn>
    </v-toolbar>
    <v-table v-if="haveAccounts">
      <thead>
        <tr>
          <th class="text-left">Nickname</th>
          <th class="text-left">Server URL</th>
          <th>
            <v-tooltip left>
              <template v-slot:activator="{ on, attrs }">
                <v-icon
                  light
                  v-bind="attrs"
                  v-on:hover="on">
                  mdi-key-variant
                </v-icon>
              </template>
              <span>
                Indicates whether the account has saved credentials.
              </span>
            </v-tooltip>
          </th>
          <th class="text-left">Username</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="account in accounts" :key="`account-${account.name}`">
          <td>{{account.name}}</td>
          <td>{{account.url}}</td>
          <td>
            <span v-if="account.auth_type === 'none'">
              <v-icon  light>
                mdi-circle-outline
              </v-icon>
              Not saved
            </span>
            <span v-else-if="account.auth_type === 'api-key'">
              <v-icon  light>
                mdi-check-circle
              </v-icon>
              API Key
            </span>
            <span v-else-if="account.auth_type === 'token-key'">
              <v-icon light>
                mdi-check-circle
              </v-icon>
              IDE Token+key
            </span>
            <span v-else-if="account.auth_type === 'token-secret'">
              <v-icon light>
                mdi-check-circle
              </v-icon>
              IDE Token+secret
            </span>
          </td>
          <td>{{account.account_name}}</td>
          <td>
            <v-icon v-if="account.source !== 'environment'"
              light
              @click="removeAccount(account.name)">
              mdi-trash-can
            </v-icon>
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-card
      v-else
      class="mx-auto mt-4"
      max-width="500"
      elevation="0"
    >
      <v-card-title>
        <span style="text-align: center; width: 100%">
          Add an account...
        </span>
      </v-card-title>
      <v-card-subtitle class="mt-2">
        <div style="text-align: center; width: 100%" >
          Click on the "plus" icon above to add a new account.<br>
          Be sure to have the account password or API key ready.<br>
        </div>
      </v-card-subtitle>
    </v-card>
  </v-list>
</template>

<script>
import axios from 'axios'

export default {
  name: 'AccountList',
  components: {
  },
  data: () => ({
    accounts: []
  }),
  created () {
    this.fetchAccounts()
  },
  methods: {
    haveAccounts () {
      return this.accounts.length !== 0
    },
    addAccount () {
      console.warn("Not Implemented")
    },
    removeAccount (name) {
      console.warn("Not Implemented");
    },
    fetchAccounts () {
      axios.get('/api/accounts').then((response) => {
        this.accounts = response.data.accounts
      })
    }
  }
}
</script>
