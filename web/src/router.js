// Copyright (C) 2023 by Posit Software, PBC.

import * as VueRouter from 'vue-router'

import AccountList from './components/AccountList.vue'

const routes = [
  { path: '/', component: AccountList }
]

const router = VueRouter.createRouter({
  mode: VueRouter.createWebHashHistory(),
  history: VueRouter.createWebHistory(),
  base: import.meta.env.BASE_URL,
  routes
})

export { router }
