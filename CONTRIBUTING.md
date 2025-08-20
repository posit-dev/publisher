# Contributing

## Quick Start

- [Contributing](#contributing)
  - [Quick Start](#quick-start)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [Committing Changes to the repo](#committing-changes-to-the-repo)
  - [Testing](#testing)
    - [Unit Tests](#unit-tests)
      - [Coverage Reporting](#coverage-reporting)
    - [End-to-End Tests](#end-to-end-tests)
      - [Requirements](#requirements)
        - [Docker Desktop](#docker-desktop)
        - [Connect Server License](#connect-server-license)
      - [Running E2E Tests](#running-e2e-tests)
  - [Development](#development)
    - [Build Tools](#build-tools)
    - [Environment Variables](#environment-variables)
      - [Behavior in GitHub Actions](#behavior-in-github-actions)
    - [Debugging in VS Code](#debugging-in-vs-code)
    - [Extension Development](#extension-development)
  - [Schema Updates](#schema-updates)
    - [Force Even Better TOML to update](#force-even-better-toml-to-update)
  - [Release](#release)
    - [Before Releasing](#before-releasing)
    - [Instructions](#instructions)
  - [Updating Dependencies](#updating-dependencies)
    - [Updating a Go dependency](#updating-a-go-dependency)

## Getting Started

These instructions will give you a copy of the project up and running on your
local machine for development and testing purposes.

### Prerequisites

- [Go](https://go.dev/dl/)
- [Just](https://github.com/casey/just?tab=readme-ov-file#installation)
- [Node.js](https://nodejs.org/en/download/)

### Setup

To get your development environment up and running, invoke the default Just command.

```console
just
```

This installs dependencies, builds and packages the Go binary and the VS Code
extension.

See the [Posit Publisher VS Code Extension CONTRIBUTING guide](./extensions/vscode/CONTRIBUTING.md)
next for setting up your development workflow.

### Committing Changes to the repo

The repo utilizes git hooks (through `husky`) to implement some standard formatting and linting.

The tools invoked are expected to be installed as packages within the root of the repo, as well as within the subdirectory `test/e2e`.

To commit one or more files, you must have first installed the npm package dependencies within both locations. This can be done from the root of the repo by:

```bash
npm install
npm install --prefix="test/e2e"
```

## Testing

This project follows the guidance written by _Ham Vocke_ in the _[The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)._ Please read the article for a detailed overview of different test types and how they are utilized.

### Unit Tests

Unit tests are written in Go and utilize the [Testify](https://github.com/stretchr/testify) framework for assertions and mocking.

```console
just test
```

#### Coverage Reporting

Coverage reporting is captured by the [cover](https://pkg.go.dev/cmd/cover) standard library. To capture coverage, run the following Just command:

```console
just cover
```

Once complete, a coverage report will open in your default browser.

### End-to-End Tests

End-to-end tests are written in JavaScript and utilize Cypress for testing the Posit Publisher VSCode extension.

These tests can be run locally to verify that the extension works as expected in a Connect environment.

These tests also run automatically in the GitHub Actions CI pipeline for pull requests after the unit tests have passed. The workflow uses the `CONNECT_LICENSE` secret stored in the repository settings to authenticate with Connect during testing. Results, including screenshots of failed tests of test runs, are uploaded as artifacts for troubleshooting. (Video replays can be optionally enabled by setting local environment variable `DEBUG_CYPRESS` or `ACTIONS_STEP_DEBUG` to true).

#### Requirements

##### Docker Desktop

To run the end-to-end tests, you will need to have Docker Desktop installed and running on your machine. (We have had issues with running
alternatives to Docker Desktop, such as Podman, so we recommend using Docker Desktop.)

The images used for the end-to-end tests are built using Dockerfiles located in the `test/e2e` directory and are currently built for
an AMD64 architecture. If you are running on an ARM64 architecture (such as Apple Silicon), you will need to ensure that your Docker installation's Virtual Machine Settings are set to:

- use the `Apple Virtualization framework` for the `Virtualization Framework` option
- the `Use Rosetta for x86_64/amd64 emulation on Apple Silicon` option is enabled.

##### Connect Server License

To run the end-to-end tests, you will need a valid Posit Connect server license.
Set the `CONNECT_LICENSE` environment variable.

```bash
export CONNECT_LICENSE="your-connect-license-key"
```

If you have to diagnose issues with the connect license, you can check the license status as reported by the Connect server by running the
following command within the e2e-connect-publisher-e2e Docker container: `cat /var/log/rstudio/rstudio-connect/rstudio-connect.log`.
Typically there will be a line which indicates a licensing failure, if that is the case.

#### E2E Test Setup

To run the end-to-end tests, you should first create a virtual environment and install the necessary dependencies.

This can be done by running the following command from the `test/e2e` subdirectory of the repository:

```bash
cd test/e2e
python3 -m venv .venv
```

Activate the virtual environment and install the dependencies:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

Build the e2e images:

```bash
just build-images
```

When done, you can deactivate the virtual environment with:

```bash
deactivate
```

#### Running E2E Tests

** NOTE: ** The instructions below assume that your terminal has the `test/e2e` directory as the current working directory. If you are not in that directory, you will need to adjust the commands accordingly.

Activate your virtual environment if it is not already active.

Run the following command from the `test/e2e` subdirectory:

```bash
source .venv/bin/activate
```

AWS Login to a vivid profile is needed to access the test user credentials for PCC by getting secrets from AWS Secret Manager:

```bash
aws sso login --profile vivid-staging
```

Build the publisher and start the Cypress interactive test runner:

```bash
just build-images
just dev
```

This will start the Cypress test runner, which will open a browser window and allow you to run the end-to-end tests against the Posit Publisher VSCode extension.

Use VSCode to modify the tests in the `test/e2e/tests` directory. Saving changes will automatically re-run the tests in the Cypress test runner.

Tests can also be run in headless mode with:

```bash
npx cypress run
```

When done, you can deactivate the virtual environment with:

```bash
deactivate
```

And detach the Docker containers with:

```bash
just stop
```

**NOTE: ** If you are updating the images in any way, where you need to rebuild the images with `just build-images`,
you will need to run the `just stop` command to remove the existing containers before running `just dev`.

#### Repeat Tests Headless Script

Allows you to run your Cypress E2E tests multiple times in headless mode, either for all tests or for specific test files. It is useful for detecting flaky tests and verifying test suite stability.

```bash
./repeat-cypress-headless.sh [REPEAT=N] [spec1] [spec2] [...]
```

## Development

### Build Tools

The build tooling entrypoint is `just`. See the [installation instructions](https://github.com/casey/just?tab=readme-ov-file#installation) for your operating system to install Just.

Execute `just -l` for a list of available commands and documentation.

### Environment Variables

When executing commands the following variables are accepted to change behavior.

| Variable | Default | Type | Description                                                                           |
| -------- | ------- | ---- | ------------------------------------------------------------------------------------- |
| CI       | false   | bool | Enable CI mode. When set to true, multi-platform builds are enabled.                  |
| DEBUG    | false   | bool | Enable DEBUG mode. When set to true, `set +x` is enabled for all Justfile targets.    |
| MODE     | dev     | enum | When set to `dev`, development is enabled. All other values disable development mode. |

#### Behavior in GitHub Actions

When running in GitHub Actions, the env variable `CI` is set to `true` by GitHub. When `CI=true`, the defaults for the following values are adjusted.

This mode can be reproduced on your local machine by setting `CI=true`.

| Variable | Default |
| -------- | ------- |
| MODE     | prod    |

### Debugging in VS Code

A `launch.json` can be found at the root in the `.vscode` directory for
debugging the Go API code.

The "Launch API" configuration will start the API at port 9001.
To change the directory that the API is started in, update the `cwd` property
to the directory you want the API to be launched at.

When debugging alongside the
[VS Code Extension](./extensions/vscode/CONTRIBUTING.md#debugging) the `cwd`
will frequently be the workspace folder of the extension host development
window.

### Extension Development

See [the Contribution Guide for the VSCode Extension](./extensions/vscode/CONTRIBUTING.md).

## Schema Updates

Schemas can be found in the `internal/schema/schemas` directory.

Non-breaking or additive changes to the schema do not require a version bump. Breaking changes to the schema require a version bump.

To update the schema:

- Update the jsonschema file (`posit-publishing-schema-v3.json` or `posit-publishing-record-schema-v3.json` for the Configuration or Deployment schemas, respectively)
- Update the corresponding example file (`config.toml` or `record.toml`).
- If you're using VSCode with the Even Better TOML extension, you can use the in-editor validation by putting the full local path to your updated schema in the `$schema` field in your TOML files.
- Verify that the unit tests pass. They load the example files and validate them against the schemas.
- The `draft` folder contains schemas that are a superset of the main schemas, and have ideas for the other settings we have considered adding. Usually we have added any new fields to those schemas and example files as well.

As Pull Requests are merged into main, we update (or create in the case of a new
schema) the file on the CDN (in S3). Currently, this is a manual process:

- Log into the AWS console (https://rstudio.awsapps.com/start/#/)
- Select `Posit Connect Production`, then `Power User`.
- Select `View all services`, then `S3`.
- Open the `Posit Publisher` bucket, then the `publisher` folder.
- Click `Upload`, then `Add Folder`.
- Select your local `schemas` folder (`internal/schema/schemas`).
- Click the `Upload` button to complete the upload.
- Verify availability of the updated schema(s) on the CDN. There may be a delay due to caching.
  - https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json
  - https://cdn.posit.co/publisher/schemas/posit-publishing-record-schema-v3.json

#### Force Even Better TOML to update

The [Even Better TOML extension](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)
caches schemas. To force it to update remove the cached schemas from the
extension's cache directory.

On macOS this can be done with the following command, replacing `$USERNAME` with
your username:

```
rm /Users/$USERNAME/Library/Application\ Support/Code/User/globalStorage/tamasfe.even-better-toml/*
```

## Release

The Posit Publisher VSCode extension releases follow guidelines from the
[VSCode Publishing Extensions docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions).

[SemVer versioning](https://semver.org/spec/v2.0.0.html) is used , but the
VSCode Marketplace will only support `major.minor.patch` for extension versions,
semver pre-release tags are not supported.

The recommendation is releases use `major.EVEN_NUMBER.patch` for release
versions and `major.ODD_NUMBER.patch` for pre-release versions.

CI facilitates this and will automatically publish as a pre-release if the
minor version number is odd.

### Before Releasing

- Ensure that all relevant changes are documented in:
  - the [CHANGELOG.md](CHANGELOG.md) for the repository
  - the [VSCode Extension CHANGELOG.md](extensions/vscode/CHANGELOG.md)
    that is bundled with the extension
  - Update the Installation instructions in [installation.md](docs/installation.md)
    for the new release, using the links to the `.vsix` files uploaded to the CDN.
  - Update the release / latest version string in the `install-publisher.bash` script.
- Update the license docs in case any new dependencies have been added, by running

```
just docs/licenses
```

and committing any changes.

### Instructions

**Step 1**

Create a proper SemVer and extension version compatible tag using the guidelines
above.

Use an even minor version for releases, or an odd minor version for
pre-releases.

_For this example, we will use the tag `v1.1.0` to create a pre-release. This
tag already exists, so you will not be able run the following commands
verbatim._

`git tag v1.1.0`

**Step 2**

Push the tag GitHub.

`git push origin v1.1.0`

This command will trigger the [Release GitHub Action](https://github.com/rstudio/publishing-client/actions/workflows/release.yaml).

**Step 3**

Once the action has completed, the release will be available on the
[Releases page](https://github.com/rstudio/publishing-client/releases), and
published to the VSCode Marketplace.

Confirm that the new version shows up in the [Visual
Studio](https://marketplace.visualstudio.com/items?itemName=Posit.publisher)
and [Open VSX](https://open-vsx.org/extension/posit/publisher) registries, and
that all expected target platforms are supported (Linux x64, Linux ARM64,
Windows x64, macOS Intel, macOS Apple Silicon).

It may take some time after the action completes for the new version to show up.

## Updating Dependencies

After a release has gone out we take the opportunity to update dependencies.

Dependencies can be adjusted at any time; the process of updating after a
release keeps us proactive.

This includes our JavaScript packages, Go version/packages, and tooling
dependencies.

Any significantly difficult dependency updates should have an issue created to
track the work and can be triaged alongside our other issues.

Updates to dependencies should be done in a separate PR.

### Updating a Go dependency

1. Run `go get <dependency>@<version>` to update the dependency. This will
   update the `go.mod` file with the new version.

   - `go get` has a `-u` option that will update all child dependencies as well.
     This is generally not recommended as it can cause unexpected problems. Use
     it with caution. `go get` will do the right thing on its own without `-u`.

   - It is best to specify the version with the `@<version>` suffix. This may be
     a semver string, a branch name, or a commit hash.

2. Update any import statements for the new version of the dependency.

3. Run `go mod vendor` to update the `vendor` directory with the new version of
   the dependency.

4. Make sure all files under vendor are included in the git commit.
