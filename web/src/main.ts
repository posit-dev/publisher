// Copyright (C) 2023 by Posit Software, PBC.

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Dark, Quasar } from 'quasar';

// Import Quasar Roboto Font
import '@quasar/extras/roboto-font/roboto-font.css';

// Import Material Icons
import '@quasar/extras/material-icons/material-icons.css';

// Import Quasar CSS
import 'quasar/dist/quasar.css';

import './style.css';
import App from './App.vue';
import { router } from './router';
import eventStream from './plugins/eventStream';

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(pinia);
app.use(Quasar, { plugins: { Dark } });
app.use(eventStream);

app.mount('#app');
