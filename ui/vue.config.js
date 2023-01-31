// Copyright (C) 2023 by Posit Software, PBC.

const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: './',
  transpileDependencies: [
    'vuetify'
  ],
  lintOnSave: false
})
