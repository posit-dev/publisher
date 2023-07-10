# Connect Client

Connect Client is an application for interfacing with Posit Connect.

<!-- markdown-toc start - Don't edit this section. Run M-x markdown-toc-refresh-toc -->
**Table of Contents**

- [Connect Client](#connect-client)
    - [Getting Started](#getting-started)
        - [Prerequisites](#prerequisites)
        - [Running](#running)
    - [Testing](#testing)
    - [Linting](#linting)
    - [Contributing](#contributing)
    - [Versioning](#versioning)
    - [Authors](#authors)

<!-- markdown-toc end -->

## Getting Started

These instructions will give you a copy of the project up and running on
your local machine for development and testing purposes.

## Prerequisites

- [Just](https://just.systems)
- [Docker](https://www.docker.com)

If you are using an Apple Silicon (M1) laptop, you may need to set the following environment variable to force Docker Desktop to build amd64 images:

```shell
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

## Running

```shell
just run
```

## Testing

```shell
just test
```

## Linting

```shell
just lint
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
