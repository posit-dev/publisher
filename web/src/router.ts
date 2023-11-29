// Copyright (C) 2023 by Posit Software, PBC.

import { createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/components/ProjectPage.vue';
import RedeploymentDestinationPageVue from 'src/views/re-deployment-destination/RedeploymentDestinationPage.vue';
import NewDeploymentDestinationPageVue from 'src/views/new-deployment-destination/NewDeploymentDestinationPage.vue';
import PublishProcessPageVue from 'src/components/PublishProcessPage.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'newDeployment', path: '/new-deployment/:account', component: NewDeploymentDestinationPageVue },
  { name: 'reDeployment', path: '/re-deployment/:account/:id', component: RedeploymentDestinationPageVue },
  { name: 'progress', path: '/progress', component: PublishProcessPageVue },
  { name: 'default', path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
});
