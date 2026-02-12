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

End-to-end tests use Cypress to test the Publisher extension in a real VS Code environment with a Posit Connect server. Tests run automatically in GitHub Actions CI after unit tests pass.

See the **[E2E Testing Guide](./test/e2e/CONTRIBUTING.md)** for setup and usage instructions.

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

When Pull Requests that modify schema files are merged into main, a GitHub Actions workflow automatically uploads the updated schemas to S3, making them available on the CDN.

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

- Ensure that all relevant changes are documented in [CHANGELOG.md](CHANGELOG.md): diff `main` against the last release, and compare with what's in `CHANGELOG.md`.
  Generally these will be the same, but sometimes things get missed. Open a PR to update `CHANGELOG.md` if anything is missing.

  Building and packaging the VSCode extension for release will [automatically sync](./extensions/vscode/justfile#L115) the VSCode changelog from the root `CHANGELOG.md`.

- Merge any "Update licenses" PRs to `main`
- Merge any release preparation PRs to `main`, e.g. any updates to `CHANGELOG.md`
- Merge any Dependabot PRs to `main`
- Wait for the `main.yaml` workflows to complete before creating a release tag

### Instructions

#### Step 1: Create a proper SemVer and extension version compatible tag

Use an even minor version for releases, or an odd minor version for
pre-releases. The example commands here use `v1.1.0`, replace this with the version you are releasing.

Make sure you are on `main` and up to date:

```sh
git switch main
git pull
```

and then create the tag:

```sh
git tag v1.1.0
```

#### Step 2: Push the tag GitHub

```sh
git push origin v1.1.0
```

This command will trigger the [Release GitHub Action](https://github.com/rstudio/publishing-client/actions/workflows/release.yaml).

#### Step 3: Confirm the release

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

Dependencies can be updated through two approaches:

1. **Automated (Preferred)**: Via Dependabot PRs that are automatically created
2. **Manual**: For cases where Dependabot cannot handle the update or special handling is needed

### Dependabot automated dependency updates

Dependabot is GitHub's automated dependency management tool that helps keep your project's dependencies up to date. It scans your repository for
dependency files and automatically creates pull requests when newer versions of your dependencies are available.

Each PR includes release notes, changelog entries, and compatibility information to help you assess the impact of the update.

After review and approval, Dependabot PRs can be merged like regular code changes.

#### Dependabot Configuration

- Configuration is maintained in `.github/dependabot.yml`
- Multiple ecosystems are monitored:
  - npm packages (root, VSCode extension, and test directories)
  - Go modules
  - Python dependencies
  - Docker images
  - GitHub Actions
  - Test data dependencies

### Manual dependency updates

Dependencies can be manually adjusted at any time; the process of updating after a
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
