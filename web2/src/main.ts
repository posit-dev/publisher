import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Quasar } from 'quasar';

import 'quasar/dist/quasar.css';

import './style.css';
import App from './App.vue';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(Quasar, {});
app.mount('#app');
