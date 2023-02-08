// Copyright (C) 2023 by Posit Software, PBC.

import Vue from 'vue'
import VueRouter from 'vue-router'
import AccountList from '../views/AccountList.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'accountList',
    component: AccountList
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
