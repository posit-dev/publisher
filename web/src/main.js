// // Copyright (C) 2023 by Posit Software, PBC.

import { createApp } from 'vue'

import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import { router } from './router'

createApp(App)
  .use(vuetify)
  .use(router)
  .mount("#app")
