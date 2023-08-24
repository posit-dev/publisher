import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Quasar } from 'quasar';

// Import Quasar Roboto Font
import '@quasar/extras/roboto-font/roboto-font.css';

// Import Material Icons
import '@quasar/extras/material-icons/material-icons.css';

// Import Quasar CSS
import 'quasar/dist/quasar.css';

import './style.css';
import App from './App.vue';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(Quasar, {});
app.mount('#app');
