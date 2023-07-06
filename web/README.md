# Publishing Client UX

This application is built using:
- [VueJS](https://vuejs.org)
    - Vue 3, Composition API w/ Setup API
- [Quasar Framework V2](https://quasar.dev/)
    - Using Quasar CLI
- [Just](https://just.systems)
- [Pnpm](https://pnpm.io/)
- [Typescript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/
- [Sass w/ SCSS syntax](https://sass-lang.com/documentation/syntax/)
- [ESLint](https://eslint.org/)
    - Using almost the same rules as Connect Dashboard project
- [Pinia](https://pinia.vuejs.org/)
- [Axios](https://axios-http.com/docs/intro)
- [Vue-i18n](https://vue-i18n.intlify.dev/)
- [Vitest](https://vitest.dev/)
- [Cypress](https://www.cypress.io/)

# NOTE:
Currently the client UX build is not done within a docker image. While this is a future TBD,
the current implementation requires a local build.

# Installing NPM (pre-requisite to installing the pre-requisites)

NOTE: npm (via nvm) is used to install pnpm... While not optimal, this was the easiest approach.
Since this is often done differently by different developers, I've included a few breadcrumbs on how
to do this. Scripts use the LTS version of npm.

Recommended:
- Install nvm: https://github.com/nvm-sh/nvm#install--update-script, and add a default alias for LTS

-- or --

- Install npm LTS directly: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

# Installing the rest of the prerequisites

1. Install pnpm:
    a. `npm install -g pnpm`
    b. `pnpm setup`
    c. `source ~/.zshrc`
2. Install Quasar CLI:
    - `pnpm install -g @quasar/cli`
3. Install Just:
    - `[Just](https://just.systems/man/en/)

# Building the client

1. Update the javascript/typescript dependencies
    - `just install`

2. Build the client
    - `just build`

# Common Developer tasks

All tasks are done through the justfile recipes, present within the `justfile` file.

- `install`

# Web Application

This application is built using [VueJS](https://vuejs.org).

## Getting Started

### Prerequisites

- [Just](https://just.systems)
- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/getting-started/install)

## Installation

Execute `just install` from this directory to install all dependencies.

```
just install
```

## Development

Execute `just start` from this directory to start a development server using [Vite](https://vitejs.dev). By default, the application is available on port 5173. Go to `http://localhost:5173` to open the application in your browser.

```shell
just start
```

## Testing

### Unit Testing

Execute `just test` from this directory to execute the unit test suite.

The unit test suite consists of JavaScript and Golang tests. Directions to run each language's test suite independently are below.

```
just test
```

#### Running JavaScript Unit Tests

Execute `yarn test` ton only execute JavaScript unit tests.

```
yarn test
```

#### Running Golang Unit Tests

Execute `go test` to only execute Golang unit tests.

```
go test
```

Note: Golang unit tests depend on a built distribution in the `./dist` directory. To rebuild the distribution, execute `just build --mode development`.










# Posit Publishing Web UI (posit-publishing-web-ui)

A Posit, PBC. project

## Install the dependencies
```bash
pnpm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```



### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
