# Publishing Client

Publishing Client is used to publish content to Posit products.

## Getting Started

These instructions will give you a copy of the project up and running on
your local machine for development and testing purposes.

### Prerequisites

NOTE: This project has been configured to use docker by default, which minimizes
the prerequisites which need to be installed. Use of docker can be controlled 
via the DOCKER environment variable:
if (DOCKER is undefined || DOCKER === 'true') {
    Tasks will be executed in a docker container using the image `build/package/Dockerfile`
} else {
    Docker will NOT be used and tasks will be natively executed.
    This is much faster than using Docker containers on Mac.
    Recommend adding `export DOCKER="false"` to your bash/zsh profile
    ex. `DOCKER="false" just`
}

If using Docker, you must have Docker installed: [Docker](https://www.docker.com)

Just (justfile runner) is used to run commands: [Just](https://just.systems)

See the additional pre-requisites required for development tasks without Docker at: 
- CLI: TBD
- UX: [`web/README.md`](./web/README.md)

If you are using an Apple Silicon (M1) laptop, you may need to set the following environment variable to force Docker Desktop to build amd64 images:

```shell
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

### Common Development Tasks

#### Building and Testing

Simplest approach to perform all of the applicable steps:
- `DOCKER="true" just` or because DOCKER=true is the default: `just`
    - This will execute the steps within a docker container, so it minimizes the setup required.
    - This is the setup which is used by dockerhub actions within CI
- `DOCKER="false" just`
    - Best for active development usage. This mode, without docker, greatly improves the I/O performance which shoud
      improve your development cycle.

Building the DOCKER image:
- If using docker (by either not setting the DOCKER environment variable or setting it to "true"), you'll need
  to build the DOCKER image. This is done as one of the steps within the `default` recipe, but you can also 
  perform it with the command `just image`.
- If you are not using docker, you can skip this step, although performing the recipe is a NO-OP.gr

Other recipes can be found by executing `just --list` for the top level project
```
build            -- Args: # Build both the web UX and server for production usage
build-dev        -- Args: # Build the production web UX and the development server
certs            -- Args: # create the security certificates
clean            -- Args: # Clean the server and web UX build artifacts as well as removing all web UX dependency packages
default          -- Args: # Clean, install, lint, build and test server & client
go-coverage      -- Args: # Profile the test code coverage of the Go code
install          -- Args: # Install any supporting packages (such as web UX javascript/typescript dependencies)
lint             -- Args: # Lint the server and the web UX source code, along with checking for copyrights. See `post-build-lint` 
lint-fix         -- Args: # Lint and FIX automatically correctable issues. See `lint` for linting without fixing.
post-build-lint  -- Args: # Lint step which requires the code be built first. Normally want to lint prior to building.
run              -- Args: *args       # Run the publishing client executable
test             -- Args: # Run all tests (unit and e2e) on the publishing client as well as web UX
test-backend     -- Args: # Run the tests on the publishing client w/ coverage profiling
web              -- Args: # Build the web UX from scratch, lint and test
```

Web recipes can be found by changing your working directory to `web` and executing `just --list`:
```
Available recipes:
    build           # build the web artifacts for the SPA (into dest/spa)
    clean           # remove build artifacts and dependencies
    default         # will run recipes: install, lint, build, and test
    dev             # start common UX development flow. Runs install recipe ahead of starting the web server which updates automatically upon file changes
    install         # update javascript/typescript dependencies
    lint            # lint the source files, do not fix the fixable items
    lint-fix        # lint the source files, fix the fixable items
    test            # perform unit and e2e tests
    test-e2e        # run e2e (Cypress) tests
    test-unit       # run unit tests one time
    test-unit-watch # run unit tests in watch mode, re-running as files are changed
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code
of conduct, and the process for submitting pull requests to us.

## Versioning

We use [Semantic Versioning](http://semver.org/) for versioning. For the versions
available, see the [tags on this repository](https://github.com/rstudio/publishing-client/tags).

## Authors

See also the list of [contributors](https://github.com/rstudio/publishing-client/contributors)
who participated in this project.
