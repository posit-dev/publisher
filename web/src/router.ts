// Copyright (C) 2023 by Posit Software, PBC.

import { RouteLocationNormalizedLoaded, createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/views/project-page/ProjectPage.vue';
import AddNewDeployment from 'src/views/add-new-deployment/AddNewDeployment.vue';
import ExistingDeploymentDestinationPage from 'src/views/existing-deployment-destination/ExistingDeploymentDestinationPage.vue';
import NewDeploymentDestinationPage from 'src/views/new-deployment-destination/NewDeploymentDestinationPage.vue';
import PublishProgressPage from 'src/views/publish-progress/PublishProgressPage.vue';
import FatalErrorPage from 'src/views/fatal-error/FatalErrorPage.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'addNewDeployment', path: '/add-new-deployment', component: AddNewDeployment },
  {
    name: 'newDeployment',
    path: '/new-deployment/:account',
    component: NewDeploymentDestinationPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      name: route.query.name,
    }),
  },
  { name: 'deployments', path: '/deployments/:name', component: ExistingDeploymentDestinationPage },
  { name: 'progress', path: '/progress', component: PublishProgressPage },
  {
    name: 'fatalError',
    path: '/error',
    component: FatalErrorPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      location: route.query.location,
      stat: route.query.status,
      code: route.query.code,
      msg: route.query.msg,
      baseURL: route.query.baseURL,
      method: route.query.method,
      url: route.query.url,
    }),
  },
  { name: 'default', path: '/:pathMatch(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes: routes,
});
