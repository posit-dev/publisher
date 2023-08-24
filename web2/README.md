# Publishing Client UX

This application is built using:
- [VueJS](https://vuejs.org)
    - Vue 3, Composition API w/ Setup API
- [Quasar Framework V2](https://quasar.dev/)
- [Just (justfiles)](https://just.systems)
- [Typescript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Sass w/ SCSS syntax](https://sass-lang.com/documentation/syntax/)
- [ESLint](https://eslint.org/)
    - Using almost the same rules as Connect Dashboard project
- [Pinia](https://pinia.vuejs.org/)
- [Axios](https://axios-http.com/docs/intro)
- [Vitest](https://vitest.dev/)
- [Cypress](https://www.cypress.io/)

# Installing the prerequisites

1. Node JS (LTS Version)
    - NOTE: use of nvm is highly recommended:
        - [NVM](https://github.com/nvm-sh/nvm#installing-and-updating)
    - Global version of node is NOT recommended, but...
        - [NodeJS](https://nodejs.org/en/download)
2. Install Just:
    - `[Just](https://just.systems/man/en/)

# Building the client

1. Default recipe will clean, image, bootstrap, validate, build and test agent & client
    - `just`

# Common Developer tasks

All tasks are done through the justfile recipes, present within the top level `justfile` file. Recipes present include macro-operations
for the multiple projects (Go and Web SPA) included in this repo.

Specialized recipes for the Go project are located within the `cmd/connect-client/justfile` and
specialized recipes for the Web project are located within the `web/justfile`.
