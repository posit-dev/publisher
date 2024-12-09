# Contributing

## Quick Start

- [Contributing](#contributing)
  - [Quick Start](#quick-start)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
      - [Option 1 - Native](#option-1---native)
    - [Installing](#installing)
    - [Execution](#execution)
  - [Testing](#testing)
    - [Unit Tests](#unit-tests)
      - [Coverage Reporting](#coverage-reporting)
    - [Integration Tests](#integration-tests)
    - [UI Tests](#ui-tests)
  - [Development](#development)
    - [Build Tools](#build-tools)
    - [Environment Variables](#environment-variables)
      - [Behavior in GitHub Actions](#behavior-in-github-actions)
    - [Debugging in VS Code](#debugging-in-vs-code)
    - [Extension Development](#extension-development)
  - [Release](#release)
    - [Instructions](#instructions)
    - [Pre-Releases](#pre-releases)
    - [Release Lifecycle](#release-lifecycle)

## Getting Started

These instructions will give you a copy of the project up and running on your
local machine for development and testing purposes.

### Prerequisites

- [Go](https://go.dev/dl/)
- [Just](https://just.systems/man/en/chapter_4.html)
- [Node.js](https://nodejs.org/en/download/)

### Installing

To get your development environment up and running, invoke the default Just command.

```console
just
```

On success, a `publisher` executable will exist in the `./bin` directory.

### Execution

Invoke the following Just command to run the built executable.

```console
just run
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

### Integration Tests

The [Bats](https://bats-core.readthedocs.io/en/stable/) framework is used to perform integration tests. For this project we use Bats to assert integrations with native machines via the Bash shell.

```
just bats
```

## Development

### Build Tools

The build tooling entrypoint is `just`. See the [installation instructions](https://just.systems/man/en/chapter_4.html) for your operating system to install Just.

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

Once complete the action has completed, the release will be available on the
[Releases page](https://github.com/rstudio/publishing-client/releases), and
published to the VSCode Marketplace.

## Updating Dependencies

After a release has gone out we take the opportunity to update dependencies.

Dependencies can be adjusted at any time; the process of updating after a
release keeps us proactive.

This includes our JavaScript packages, Go version/packages, and tooling
dependencies.

Any significantly difficult dependency updates should have an issue created to
track the work and can be triaged alongside our other issues.

Updates to dependencies should be done in a separate PR.
