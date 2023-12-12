// Copyright (C) 2023 by Posit Software, PBC.

import { createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/views/project-page/ProjectPage.vue';
import AddNewDeployment from 'src/views/add-new-deployment/AddNewDeployment.vue';
import ExistingDeploymentDestinationPage from 'src/views/existing-deployment-destination/ExistingDeploymentDestinationPage.vue';
import NewDeploymentDestinationPage from 'src/views/new-deployment-destination/NewDeploymentDestinationPage.vue';
import PublishProgressPage from 'src/views/publish-progress/PublishProgressPage.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'addNewDeployment', path: '/add-new-deployment', component: AddNewDeployment },
  // newDeployment route also supports optional query parameters of id and name
  { name: 'newDeployment', path: '/new-deployment/:account', component: NewDeploymentDestinationPage },
  { name: 'deployments', path: '/deployments/:id', component: ExistingDeploymentDestinationPage },
  { name: 'progress', path: '/progress', component: PublishProgressPage },
  { name: 'default', path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
});
