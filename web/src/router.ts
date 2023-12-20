// Copyright (C) 2023 by Posit Software, PBC.

import { RouteLocationNormalizedLoaded, createRouter, createWebHashHistory } from 'vue-router';

import ProjectPage from 'src/views/project-page/ProjectPage.vue';
import AddNewDeployment from 'src/views/add-new-deployment/AddNewDeployment.vue';
import ExistingDeploymentPage from 'src/views/existing-deployment/ExistingDeploymentPage.vue';
import NewDeploymentPage from 'src/views/new-deployment/NewDeploymentPage.vue';
import DeployProgressPage from 'src/views/deploy-progress/DeployProgressPage.vue';
import FatalErrorPage from 'src/views/fatal-error/FatalErrorPage.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'addNewDeployment', path: '/add-new-deployment', component: AddNewDeployment },
  {
    name: 'newDeployment',
    path: '/new-deployment/:account',
    component: NewDeploymentPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      name: route.query.name,
      url: route.query.url,
    }),
  },
  { name: 'deployments', path: '/deployments/:name', component: ExistingDeploymentPage },
  {
    name: 'progress',
    path: '/progress',
    component: DeployProgressPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      name: route.query.name,
      operation: route.query.operation,
      id: route.query.id,
    }),
  },
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
  scrollBehavior() {
    // always scroll to top
    return { top: 0 };
  },
});
