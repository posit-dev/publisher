// Copyright (C) 2023 by Posit Software, PBC.

import { createApp } from "vue";
import { createPinia } from "pinia";
import { Dark, Dialog, Quasar, QuasarUIConfiguration } from "quasar";

// Import Quasar Roboto Font
import "@quasar/extras/roboto-font/roboto-font.css";

// Import Material Icons
import "@quasar/extras/material-icons/material-icons.css";

// Import Quasar CSS
import "quasar/src/css/index.sass";

import "./style.css";
import App from "./App.vue";
import { router } from "./router";
import eventStream from "./plugins/eventStream";
import { vscode, getVscodeTheme, onVscodeThemeChange } from "./vscode";
import "@github/relative-time-element";

const pinia = createPinia();
const app = createApp(App);

const quasarUiConfig: QuasarUIConfiguration = { dark: "auto" };
if (vscode) {
  switch (getVscodeTheme()) {
    case "light":
      quasarUiConfig.dark = false;
      break;
    case "dark":
      quasarUiConfig.dark = true;
      break;
  }

  onVscodeThemeChange((theme) => {
    switch (theme) {
      case "light":
      case "high-contrast-light":
        Dark.set(false);
        break;
      case "dark":
      case "high-contrast-dark":
        Dark.set(true);
        break;
    }
  });
}

app.use(router);
app.use(pinia);
app.use(Quasar, { config: quasarUiConfig, plugins: { Dark, Dialog } });
app.use(eventStream);

app.mount("#app");
