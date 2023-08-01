# Publishing Client UX

This application is built using:
- [VueJS](https://vuejs.org)
    - Vue 3, Composition API w/ Setup API
- [Quasar Framework V2](https://quasar.dev/)
    - Using Quasar CLI
- [Just (justfiles)](https://just.systems)
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
2. Install Just:
    - `[Just](https://just.systems/man/en/)

# Building the client

1. Default recipe will clean, image, bootstrap, validate, build and test agent & client
    - `just`

# Common Developer tasks

All tasks are done through the justfile recipes, present within the top level `justfile` file. Recipes present include macro-operations
for the multiple projects (Go and Web SPA) included in this repo. It also includes specialized recipes for the Go project, as the top
level project directory is most commonly used to interact with that project. Specialized recipes for the Web project are located within
the `web/justfile`, as most interactions with the web project are done within the `web` directory.

The top level `justfile` recipes can be displayed from within the top level repo subdirectory by issuing the command: `just --list`

Available recipes:
    bootstrap           # bootstrap any supporting packages (such as go package or web UX javascript/typescript dependencies)
    build               # Build both the web UX and agent for production usage
    build-agent         # Build the production agent using the existing build of the Web UX
    build-agent-dev     # Build the development agent using the existing build of the Web UX
    build-web           # Build the web UX
    certs               # create the security certificates
    clean               # Clean the agent and web UX build artifacts as well as remove all web UX dependency packages.
    default             # clean, image, bootstrap, validate, build and test agent & client (pre-run 'clean' if switching between use of DOCKER containers)
    image               # Build the image. Typically does not need to be done very often.
    run-agent *args     # Run the publishing agent executable
    test                # Run all tests (unit and e2e) on the agent as well as web UX
    test-agent          # Run the tests on the agent w/ coverage profiling
    test-agent-coverage # Display the test code coverage of the Go code, from last test run
    test-web            # run the tests on the Web UX
    validate            # Validate the agent and the web UX source code, along with checking for copyrights. See the `validate-post` recipe for linting which requires a build.
    validate-fix        # Validate and FIX automatically correctable issues. See the `validate` recipe for linting without fixing.
    validate-post       # Validate step which requires the code to be built first. Normally want to validate prior to building.

As referenced above, a supporting `justfile` exists for the web project. The recipes included within this justfile are dedicated to
Web Development.

Available recipes within the web/justfile are:
    bootstrap       # update javascript/typescript dependencies
    build           # build the web artifacts for the SPA (into dest/spa)
    clean           # remove build artifacts and dependencies
    default         # will run recipes: bootstrap, validate, build, and test
    dev             # start common UX development flow. Start the web server which updates automatically upon file changes
    test            # perform unit, go race and e2e tests
    test-e2e        # run e2e (Cypress) tests
    test-race       # perform race testing
    test-unit       # run unit tests one time
    test-unit-watch # run unit tests in watch mode, re-running as files are changed
    validate        # validate the source files, do not fix the fixable items
    validate-fix    # validate the source files, fix the fixable items
