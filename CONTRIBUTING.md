# Contributing

## Quick Start

- [Contributing](#contributing)
  - [Quick Start](#quick-start)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [Committing Changes to the repo](#committing-changes-to-the-repo)
  - [Architecture](#architecture)
  - [Testing](#testing)
    - [Unit Tests](#unit-tests)
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

## Getting Started

These instructions will give you a copy of the project up and running on your
local machine for development and testing purposes.

### Prerequisites

- [Just](https://github.com/casey/just?tab=readme-ov-file#installation)
- [Node.js](https://nodejs.org/en/download/) (LTS recommended; [nvm](https://github.com/nvm-sh/nvm) is a good version manager)
- [R](https://www.r-project.org/) with the `renv` package — needed for R-related tests. [rig](https://github.com/r-lib/rig) is a convenient installer. After installing R, run `R -e 'install.packages("renv")'`.
- [Visual Studio Code](https://code.visualstudio.com/download) with the recommended workspace extensions (see below)

#### VS Code Extensions

When you open the `extensions/vscode` workspace, VS Code will prompt you to install recommended extensions. If you miss the prompt, install them manually:

- **`connor4312.esbuild-problem-matchers`** — **Required** to run the extension debug launch configurations. This is the most commonly missed prerequisite.
- `dbaeumer.vscode-eslint` — ESLint integration
- `esbenp.prettier-vscode` — Prettier formatting

### Setup

To get your development environment up and running, invoke the default Just command.

```console
just
```

This installs dependencies and packages the VS Code extension.

See the [Posit Publisher VS Code Extension CONTRIBUTING guide](./extensions/vscode/CONTRIBUTING.md)
next for setting up your development workflow.

### Committing Changes to the repo

The repo utilizes git hooks (through `husky`) to implement some standard formatting and linting.

The hooks depend on the root workspace's npm packages, which cover every workspace member (extensions/vscode, webviews/homeView, packages/\*, and the TypeScript test packages). A single install at the repo root is enough:

```bash
npm install
```

If you also work on the e2e Cypress suite, install its deps separately — that package is deliberately outside the workspace:

```bash
npm install --prefix=test/e2e
```

## Architecture

Posit Publisher is a pure TypeScript project with two major sections:

- A TypeScript Positron / VS Code extension that implements all publishing logic and
  communicates with Connect / Connect Cloud servers directly.
- A Vue webview that provides the sidebar UI in the IDE.

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  Posit Connect Server               │  │  `.posit/publish/` (on disk)        │
│  (or Connect Cloud)                 │  │                                     │
│                                     │  │  `*.toml` — configurations          │
│  Content management, bundle upload, │  │    How content should be deployed:  │
│  deployment, task polling,          │  │    type, entrypoint, packages, etc. │
│  authentication                     │  │                                     │
│                                     │  │  `deployments/*.toml` — records     │
│                                     │  │    Where content was deployed and   │
│                                     │  │    how it was configured at the     │
│                                     │  │    time of deployment.              │
│                                     │  │                                     │
│                                     │  │  The extension watches these files  │
│                                     │  │  and refreshes the webview.         │
└──────────────────┬──────────────────┘  └──────────────────┬──────────────────┘
                   │                                        │
             HTTPS │                                        │  reads/writes
                   │                                        │
┌──────────────────┴────────────────────────────────────────┴──────────────────┐
│  VSCode Extension Host (TypeScript)                                          │
│  `extensions/vscode/src/`                                                    │
│                                                                              │
│  Owns all business logic:                                                    │
│  - Project inspection (Python/R/Quarto)                                      │
│  - Configuration & deployment record I/O                                     │
│  - Credential storage (keyring or file)                                      │
│  - Bundle creation (file packaging)                                          │
│  - Publishing orchestration                                                  │
│  - All communication with Connect / Connect Cloud servers                    │
│                                                                              │
│  Uses the shared npm packages:                                               │
│  - `@posit-dev/connect-api` — axios client for Posit Connect                 │
│  - `@posit-dev/connect-cloud-api` — client + OAuth for Connect Cloud         │
└───────────────────────────┬──────────────────────────────────────────────────┘
                            │
                postMessage │
                     (JSON) │
             Typed messages │
              serialized by │
                  "conduit" │
                   classes: │
           `WebviewConduit` │
              `HostConduit` │
                            │
┌───────────────────────────┴──────────────────────────────────────────────────┐
│  Vue Webview (Sidebar UI)                                                    │
│  `webviews/homeView/`                                                        │
│                                                                              │
│  Vue + Pinia app rendered in a VSCode webview iframe. A webview gives us     │
│  full control over the UI beyond what the IDE's APIs provide. Has no         │
│  direct access to Node.js, the filesystem, or the VS Code API. Uses          │
│  `postMessage` from VS Code's `WebviewApi` to communicate with the           │
│  extension host.                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Deployment flow (end to end):**

1. User clicks Deploy
2. Webview sends deploy message via `postMessage`
3. Extension host receives it, inspects the project, bundles files, and uploads to Connect
4. Deployment progress events flow through the extension's in-process `EventStream`
5. Extension forwards status to webview via `postMessage`
6. Webview updates UI reactively via Pinia stores

## Testing

This project follows the guidance written by _Ham Vocke_ in the _[The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)._ Please read the article for a detailed overview of different test types and how they are utilized.

### Unit Tests

The VSCode extension uses [Mocha](https://mochajs.org) for integration tests (under `extensions/vscode/src/test/`) and [Vitest](https://vitest.dev) for unit tests (`src/**/*.test.ts` alongside the source).

From `extensions/vscode/`:

```console
just test
```

TypeScript packages under `packages/` use Vitest.

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

Debug configurations for the extension itself live at
[`extensions/vscode/.vscode/launch.json`](./extensions/vscode/.vscode/launch.json).
See the [extension CONTRIBUTING guide](./extensions/vscode/CONTRIBUTING.md#debugging) for details.

### Extension Development

See [the Contribution Guide for the VSCode Extension](./extensions/vscode/CONTRIBUTING.md).

## Schema Updates

Schemas live at `extensions/vscode/src/toml/schemas/`.

Non-breaking or additive changes to the schema do not require a version bump. Breaking changes to the schema require a version bump.

To update the schema:

- Update the jsonschema file (`posit-publishing-schema-v3.json` or `posit-publishing-record-schema-v3.json` for the Configuration or Deployment schemas, respectively)
- Update the corresponding example file (`config.toml` or `record.toml`).
- If you're using VSCode with the Even Better TOML extension, you can use the in-editor validation by putting the full local path to your updated schema in the `$schema` field in your TOML files.
- Verify that the unit tests pass. They load the example files and validate them against the schemas.
- The `draft` folder contains schemas that are a superset of the main schemas, and have ideas for the other settings we have considered adding. Usually we have added any new fields to those schemas and example files as well.
- Version bump only: update in-code references to the schema URL (code that writes the TOML files, tests)

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

[SemVer versioning](https://semver.org/spec/v2.0.0.html) is used, but the
VSCode Marketplace only supports `major.minor.patch` for extension versions;
semver pre-release tags are not supported.

The recommendation is releases use `major.EVEN_NUMBER.patch` for release
versions and `major.ODD_NUMBER.patch` for pre-release versions.

CI facilitates this and will automatically publish as a pre-release if the
minor version number is odd.

### Before Releasing

- Merge any "Update licenses" PRs to `main`
- Merge any Dependabot PRs to `main`
- Wait for the `main.yaml` workflows to complete

### Instructions

The release process is automated via GitHub Actions workflows.

#### Step 1: Run the Prepare Release workflow

1. Go to [Actions > Prepare Release](https://github.com/posit-dev/publisher/actions/workflows/prepare-release.yaml)
2. Click "Run workflow"
3. Enter the version number (e.g., `1.34.0`)
   - Must use even minor version for production releases
   - Do not include the `v` prefix
4. Click "Run workflow"

This workflow will:

- Create a `release/v{version}` branch
- Run the prepare-release script to update changelog files
- Create a pull request for review

#### Step 2: Review and merge the release PR

1. Review the PR to verify changelog entries are complete and accurate
2. Ensure all PRs with user-facing changes since the last release have changelog entries
3. Merge the PR when ready

#### Step 3: Automatic tag creation and release

When the release PR is merged, automation takes over:

1. The `tag-on-release-merge` workflow automatically creates the version tag
2. The tag triggers the `release` workflow which:
   - Builds release artifacts for all platforms
   - Creates a GitHub release
   - Publishes to VS Code Marketplace and Open VSX
   - Sends a Slack notification to announce the release

#### Step 4: Confirm the release

Once the workflows complete, verify:

- The release appears on the [Releases page](https://github.com/posit-dev/publisher/releases)
- The new version shows up in [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Posit.publisher) and [Open VSX](https://open-vsx.org/extension/posit/publisher)
- All expected target platforms are supported (Linux x64, Linux ARM64, Windows x64, macOS Intel, macOS Apple Silicon)

It may take some time after the workflows complete for the new version to appear in the marketplaces.

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
  - Python dependencies
  - Docker images
  - GitHub Actions
  - Test data dependencies

### Manual dependency updates

Dependencies can be manually adjusted at any time; the process of updating after a
release keeps us proactive.

This includes our JavaScript packages and tooling dependencies.

Any significantly difficult dependency updates should have an issue created to
track the work and can be triaged alongside our other issues.

Updates to dependencies should be done in a separate PR.
