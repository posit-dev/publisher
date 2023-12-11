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
    Tasks will be executed in a docker container using the image `build/ci/Dockerfile`
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
    - Best for active development usage. This mode, without docker, greatly improves the I/O performance which should
      improve your development cycle.

Building the DOCKER image:
- If using docker (by either not setting the DOCKER environment variable or setting it to "true"), you'll need
  to build the DOCKER image. This is done as one of the steps within the `default` recipe, but you can also
  perform it with the command `just image`.
- If you are not using docker, you can skip this step, although performing the recipe is a NO-OP.

#### Justfiles

All tasks are done through the justfile recipes, present within the top level `justfile` file. Recipes present include macro-operations
for the multiple projects (Go and Web SPA) included in this repo.

Specialized recipes for the Go project are located within the `cmd/publisher/justfile` and
specialized recipes for the Web project are located within the `web/justfile`.

The top level `justfile` recipes can be displayed from within the top level repo subdirectory by issuing the command: `just --list`

A supporting `justfile` exists for the web project. The recipes included within this justfile are dedicated to Web Development.

If you want to build the development version the easiest (after switching branches for example), run `just build-dev`.

#### Development workflow for UX modifications

1. Build and start the vite web server, to support error reporting and hot-reloading: `just web/dev` in one terminal. Keep the terminal window open.
    - This will launch the `vite` web server on `http://127.0.0.1:9000`
2. Within a new terminal window, build the development version of the CLI: `just build-dev`. Keep this terminal open, so that you can rebuild as needed.
3. Within a new terminal window, launch the development version of the CLI for the current platform (with these parameters): `./connect-client ui <PROJECT_PATH> --listen=127.0.0.1:9001 --open-browser-at="http://127.0.0.1:9000"`
    - *Where** `<PROJECT_PATH>` above is replaced with a location of a sample project. For example, with a python project at `~/dev/connect-content/bundles/python-flaskapi`, your complete command line would become: `./connect-client ui ~/dev/connect-content/bundles/python-flaskapi --listen=127.0.0.1:9001 --open-browser-at="http://127.0.0.1:9000"`.
    - This launches the CLI and configures it to listen on port `9001`, while launching a browser to the address which is being served by the `vite` web server.

You now should have a Web UX loaded within the browser, which is loading from the `vite` dev server, but has its APIs serviced from the CLI backend.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code
of conduct, and the process for submitting pull requests to us.

### VSCode Setup

If developing using VSCode you can install the recommended extensions and setup
your workspace with our recommended settings to get started:

```bash
cp .vscode/recommended.settings.json .vscode/settings.json
```

## Versioning

We use [Semantic Versioning](http://semver.org/) for versioning. For the versions
available, see the [tags on this repository](https://github.com/rstudio/publishing-client/tags).

## Authors

See also the list of [contributors](https://github.com/rstudio/publishing-client/contributors)
who participated in this project.
