// Copyright (C) 2023 by Posit Software, PBC.

import Vue from 'vue'
import VueRouter from 'vue-router'
import ServerList from '../views/ServerList.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'serverList',
    component: ServerList
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
