# Publishing Client UX

This application is built using:
- [VueJS](https://vuejs.org)
    - Vue 3, Composition API w/ Setup API
- [Quasar Framework V2](https://quasar.dev/)
    - Using Quasar CLI
- [Just](https://just.systems)
- [Typescript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Sass w/ SCSS syntax](https://sass-lang.com/documentation/syntax/)
- [ESLint](https://eslint.org/)
    - Using almost the same rules as Connect Dashboard project
- [Pinia](https://pinia.vuejs.org/)
- [Axios](https://axios-http.com/docs/intro)
- [Vue-i18n](https://vue-i18n.intlify.dev/)
- [Vitest](https://vitest.dev/)
- [Cypress](https://www.cypress.io/)

# Installing the prerequisites

1. Node JS (LTS Version)
    - NOTE: use of nvm is highly recommended:
        - [NVM](https://github.com/nvm-sh/nvm#installing-and-updating)
    - Global version of node is NOT recommended, but...
        - [NodeJS](https://nodejs.org/en/download)
1. Install Quasar CLI:
    - `npm install -g @quasar/cli`
2. Install Just:
    - `[Just](https://just.systems/man/en/)

# Building the client

1. Default recipe will clean, install, lint, build and test
    - `just`

# Common Developer tasks

All tasks are done through the justfile recipes, present within the `justfile` file.
They can be displayed at the command line with: `just --list`

Recipes include:
build            -- Args: # build the web artifacts for the SPA (into dest/spa)
clean            -- Args: # remove build artifacts and dependencies
default          -- Args: # will run recipes: install, lint, build and test
dev              -- Args: # start common UX development flow. Runs install recipe ahead of starting webserver whic
install          -- Args: # update javascript/typescript dependencies
lint             -- Args: # lint the source files, do not fix the fixable items
lint-fix         -- Args: # lint the source files, fix the fixable items
test             -- Args: # perform unit and e2e tests
test-e2e         -- Args: # run e2e (Cypress) tests
test-unit        -- Args: # run unit tests one time
test-unit-watch  -- Args: # run unit tests in watch mode, re-running as files are changed
