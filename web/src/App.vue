<!-- Copyright (C) 2023 by Posit Software, PBC. -->
<template>
  <v-app app>
    <v-app-bar
      color="blue accent-4"
      dense
      dark
      elevation="5"
      app
    >
      <v-app-bar-nav-icon />

      <v-toolbar-title>Posit Publishing Client</v-toolbar-title>

      <v-spacer />

      <v-btn icon>
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-app-bar>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script>

export default {
  name: 'App',
  data: () => ({})
}
</script>
