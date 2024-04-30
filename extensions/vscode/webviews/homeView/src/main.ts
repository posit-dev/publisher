// Copyright (C) 2024 by Posit Software, PBC.

import { createApp } from "vue";
import { createPinia } from "pinia";
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeProgressRing,
  vsCodeDivider,
} from "@vscode/webview-ui-toolkit";

import App from "src/App.vue";

import "src/style.css";

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeProgressRing(),
  vsCodeDivider(),
);

const pinia = createPinia();

createApp(App).use(pinia).mount("#app");
