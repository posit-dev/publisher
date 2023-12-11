// Copyright (C) 2023 by Posit Software, PBC.

import { createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/views/project-page/ProjectPage.vue';
import AddNewDeployment from 'src/views/add-new-deployment/AddNewDeployment.vue';
import ExistingDeploymentDestinationPageVue from 'src/views/existing-deployment-destination/ExistingDeploymentDestinationPage.vue';
import NewDeploymentDestinationPageVue from 'src/views/new-deployment-destination/NewDeploymentDestinationPage.vue';
import PublishProcessPageVue from 'src/components/PublishProcessPage.vue';
import PublishLogView from 'src/views/publish-log-view/PublishLogView.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'addNewDeployment', path: '/add-new-deployment', component: AddNewDeployment },
  { name: 'newDeployment', path: '/new-deployment/:account/:contentId?', component: NewDeploymentDestinationPageVue },
  { name: 'deployments', path: '/deployments/:id', component: ExistingDeploymentDestinationPageVue },
  { name: 'progress', path: '/progress', component: PublishProcessPageVue },
  { name: 'detailedProgress', path: '/progress/detailed', component: PublishLogView },
  { name: 'default', path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
});
