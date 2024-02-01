// Copyright (C) 2023 by Posit Software, PBC.

import { RouteLocationNormalizedLoaded, createRouter, createWebHistory } from 'vue-router';

import ProjectPage from 'src/views/project-page/ProjectPage.vue';
import AddNewDeployment from 'src/views/add-new-deployment/AddNewDeployment.vue';
import DeploymentPage from 'src/views/deployment/DeploymentPage.vue';
import DeployProgressPage from 'src/views/deploy-progress/DeployProgressPage.vue';
import AgentLogPage from 'src/views/AgentLogPage.vue';
import FatalErrorPage from 'src/views/fatal-error/FatalErrorPage.vue';

const routes = [
  { name: 'root', path: '/', redirect: { name: 'project' } },
  { name: 'agentLog', path: '/agent/log', component: AgentLogPage },
  { name: 'project', path: '/project', component: ProjectPage },
  { name: 'addNewDeployment', path: '/add-new-deployment', component: AddNewDeployment },
  {
    name: 'deployments',
    path: '/deployments/:name',
    component: DeploymentPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      name: route.params.name,
      preferredAccount: route.query.preferredAccount,
    }),
  },
  {
    name: 'progress',
    path: '/deployments/:name/progress',
    component: DeployProgressPage,
    props: (route: RouteLocationNormalizedLoaded) => ({
      name: route.params.name,
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
  history: createWebHistory(),
  routes: routes,
  scrollBehavior() {
    // always scroll to top
    return { top: 0 };
  },
});
