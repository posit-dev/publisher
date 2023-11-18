// Copyright (C) 2023 by Posit Software, PBC.

import { createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/components/ProjectPage.vue';
import DeploymentDestinationPageVue from 'src/components/DeploymentDestinationPage.vue';
import PublishProcessPageVue from 'src/components/PublishProcessPage.vue';

const routes = [
  { path: '/', component: ProjectPage },
  { path: '/destination/:id', component: DeploymentDestinationPageVue },
  { path: '/progress', component: PublishProcessPageVue },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
});
