// Copyright (C) 2024 by Posit Software, PBC.

import { createApp, inject } from "vue";
import App from "./App.vue";

const theWindow = inject("window");

createApp(App).mount("#app");
