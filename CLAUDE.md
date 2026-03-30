# Project Overview

Posit Publisher is a VSCode/Positron extension that enables deploying Python and R projects to Posit Connect. The project is in an active Go-to-TypeScript migration, with a hybrid architecture:

- **Go backend** (`cmd/publisher/`, `internal/`) - API server handling deployments, credential validation, content inspection, and Connect server communication. Still required at runtime.
- **TypeScript packages** (`packages/`) - Shared TypeScript libraries for Connect API communication (preparation for future migration of remaining Go backend features)
- **VSCode extension** (`extensions/vscode/`) - TypeScript extension providing the UI and increasingly handling operations directly (bundling, TOML handling, interpreter detection, dependency analysis)
- **Webviews** (`extensions/vscode/webviews/homeView/`) - Vue 3 UI components for the extension sidebar

## Migration Status

The following features have been **migrated to TypeScript** and run directly in the extension (no Go backend call):

| Feature                                | TypeScript Location                                                           | Former Go Package                          |
| -------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| Bundle creation (tar.gz)               | `extensions/vscode/src/bundler/`                                              | `internal/bundles/`                        |
| TOML config reading/writing            | `extensions/vscode/src/toml/`                                                 | `internal/config/`, `internal/deployment/` |
| Deployment record handling             | `extensions/vscode/src/toml/deployment*.ts`                                   | `internal/deployment/`                     |
| Config file discovery/loading          | `extensions/vscode/src/toml/config*.ts`, `extensions/vscode/src/configFiles/` | `internal/config/`                         |
| File collection (.gitignore filtering) | `extensions/vscode/src/bundler/collect.ts`                                    | `internal/bundles/`                        |
| Manifest generation                    | `extensions/vscode/src/bundler/manifestFromConfig.ts`                         | `internal/bundles/`                        |
| Python interpreter detection           | `extensions/vscode/src/interpreters/pythonInterpreter.ts`                     | `internal/interpreters/`                   |
| R interpreter detection                | `extensions/vscode/src/interpreters/rInterpreter.ts`                          | `internal/interpreters/`                   |
| R package lockfile scanning            | `extensions/vscode/src/interpreters/rPackages.ts`                             | `internal/interpreters/`                   |
| Python package scanning                | `extensions/vscode/src/interpreters/pythonPackages.ts`                        | Go POST `/packages/python/scan`            |
| Dependency analysis                    | `extensions/vscode/src/publish/dependencies.ts`                               | `internal/bundles/`                        |
| Project file tree                      | `extensions/vscode/src/projectFiles/`                                         | N/A (new)                                  |
| Credential storage                     | `extensions/vscode/src/credentials/`                                          | `internal/credentials/` (partially)        |

The following features are **still in Go** and accessed via the Go backend HTTP API:

| Feature                          | Go Location         | Extension API Wrapper                       |
| -------------------------------- | ------------------- | ------------------------------------------- |
| Publishing/deployment to Connect | `internal/publish/` | `src/api/resources/`                        |
| Deployment cancellation          | `internal/publish/` | `src/api/resources/`                        |
| Content inspection/detection     | `internal/inspect/` | `src/api/resources/`                        |
| Connect Cloud OAuth flows        | `internal/cloud/`   | `src/api/resources/ConnectCloud.ts`         |
| Snowflake connection discovery   | `internal/clients/` | `src/api/resources/SnowflakeConnections.ts` |
| Connect token management         | `internal/clients/` | `src/api/resources/Credentials.ts`          |
| Server-Sent Events streaming     | `internal/events/`  | `src/events.ts`                             |

**Prepared but not yet integrated:**

- `packages/connect-api/` - TypeScript client for Posit Connect REST API
- `packages/connect-cloud-api/` - TypeScript client for Connect Cloud API (with OAuth)

These packages are groundwork for migrating the remaining Go backend API calls to TypeScript.

# Build Commands

The project uses [Just](https://github.com/casey/just) as the build tool. Run `just -l` to see all available commands.

```bash
# Full build (clean, build Go binary, package VSCode extension)
just

# Build Go binary only
just build

# Run Go unit tests (excludes functional tests)
just test

# Run all tests including functional tests
just test ./...

# Run a single Go test
go test -run TestName ./internal/package/...

# Lint Go code
just lint

# View test coverage in browser
just cover

# Format all code
just format
```

## VSCode Extension Development

```bash
# From extensions/vscode/ directory:
just                    # Clean, configure, and package
just deps               # Install npm dependencies
just lint               # Run ESLint
just test               # Run extension tests (Mocha + Vitest)
just package            # Package .vsix file

# Rebuild webviews after changes
npm run build --prefix webviews/homeView
```

To run the extension in development:

1. Open `extensions/vscode/` as workspace in VSCode
2. Run "Run Extension" debug configuration (F5)

## E2E Tests

E2E tests use Cypress and require Docker. From `test/e2e/`:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
just build-images       # Build Docker images (first time)
just dev                # Build publisher + run Cypress interactively
just stop               # Stop Docker containers
```

# Architecture

## Runtime Architecture

The extension spawns the Go binary (`bin/publisher`) as a subprocess and communicates via HTTP API and Server-Sent Events. Many operations now run directly in TypeScript without calling the Go backend.

```
VSCode Extension (TypeScript)
├── Local Operations (no Go backend needed):
│   ├── TOML config/deployment reading & writing
│   ├── Bundle creation (tar.gz with manifest)
│   ├── File collection with .gitignore filtering
│   ├── Python/R interpreter detection
│   ├── Python/R package scanning
│   ├── Dependency analysis
│   └── Credential storage (filesystem / VSCode keychain)
│
└── Go Backend Operations (via HTTP API):
    ├── Publishing/deployment to Connect
    ├── Content inspection/detection
    ├── Connect Cloud authentication (OAuth)
    ├── Snowflake connection discovery
    └── Server-Sent Events for deployment progress
```

## Go Backend (`internal/`)

Key packages (still actively used):

- `clients/` - HTTP clients for Connect API communication
- `cloud/` - Connect Cloud OAuth integration
- `events/` - Server-Sent Events for real-time UI updates
- `inspect/` - Project inspection (detect Python/R/Quarto content)
- `publish/` - Core publishing logic to Connect servers
- `services/api/` - HTTP API endpoints consumed by the extension

Legacy packages (functionality migrated to TypeScript but code still present):

- `accounts/` - Server account/credential management
- `bundles/` - Deployment bundle creation and manifest generation
- `config/` - Configuration file parsing (`.posit/publish/*.toml`)
- `credentials/` - Credential storage (keyring or file-based)
- `deployment/` - Deployment record management
- `interpreters/` - Python/R interpreter detection and version management
- `schema/` - JSON schemas for configuration validation

The CLI entry point (`cmd/publisher/main.go`) uses [Kong](https://github.com/alecthomas/kong) for command parsing. The `ui` command starts an HTTP API server that the VSCode extension communicates with.

## TypeScript Packages (`packages/`)

Shared npm packages for Connect API communication:

- `packages/connect-api/` - TypeScript client for the Posit Connect REST API (axios-based)
- `packages/connect-cloud-api/` - TypeScript client for Connect Cloud API with OAuth authentication

These are not yet consumed by the extension but are being prepared for future migration of Go backend API calls.

## VSCode Extension (`extensions/vscode/src/`)

Key areas:

- **Bundler** (`src/bundler/`) - Creates deployment bundles (tar.gz) with manifest generation, file collection, and .gitignore filtering
- **TOML** (`src/toml/`) - Reads/writes configuration and deployment TOML files with schema validation
- **Interpreters** (`src/interpreters/`) - Detects Python/R versions and scans packages
- **Credentials** (`src/credentials/`) - Manages credential storage (filesystem or VSCode keychain)
- **Publish** (`src/publish/`) - Dependency analysis for Python/R projects
- **API** (`src/api/`) - Axios HTTP client for Go backend communication (for features not yet migrated)
- **Views** (`src/views/`) - Sidebar webview and tree view providers
- **Servers** (`src/servers.ts`) - Go binary subprocess management
- **State** (`src/state.ts`) - Central state management for the extension

## Configuration Files

User projects contain:

- `.posit/publish/*.toml` - Deployment configurations (schema: `posit-publishing-schema-v3.json`)
- `.posit/publish/deployments/*.toml` - Deployment records tracking where content was deployed

# Additional Documentation

Subdirectories contain more detailed CLAUDE.md files:

- `extensions/vscode/CLAUDE.md` - VSCode extension development
- `extensions/vscode/webviews/homeView/CLAUDE.md` - Vue webview development

# Testing Conventions

- Go tests use [Testify](https://github.com/stretchr/testify) for assertions and mocking
- Tests with external dependencies are skipped when using `-short` flag (e.g., `go test -short ./...`)
- VSCode extension uses Mocha for integration tests, Vitest for unit tests
- TypeScript packages (`packages/`) use Vitest
- Mock files follow `*_mock.go` or `mock_*.go` naming in Go
- TypeScript test files are colocated with source (`*.test.ts`)

# Updating Dependencies

## Go dependencies

```bash
go get <dependency>@<version>
go mod vendor
# Commit all vendor changes
```

## NPM dependencies

Handled via Dependabot PRs or manual updates. Install hooks before committing:

```bash
npm install
npm install --prefix="test/e2e"
```

# Git Workflow

**CRITICAL: Never push directly to main.** All changes must go through pull requests.

Even for "quick fixes" or "urgent hotfixes":

1. Create a new branch from main
2. Make your changes on the branch
3. Push the branch and open a PR
4. Wait for review/approval before merging

Do NOT use `git push origin main` under any circumstances. If you find yourself about to push to main, stop and create a branch instead.

# CHANGELOG Conventions

When adding entries to CHANGELOG.md:

- **Reference issue numbers, not PR numbers.** Issues represent the user-facing problem or feature request. Use `(#1234)` format where `1234` is the GitHub issue number.
- If no issue exists for the change, create one before adding the changelog entry.
- Follow [Keep a Changelog](https://keepachangelog.com/) format with sections: Added, Changed, Fixed, Deprecated, Removed, Security.
- Write entries from the user's perspective, focusing on what changed for them.
- Use the `/changelog` skill to help draft entries.

# Schema Updates

Schemas exist in both `extensions/vscode/src/toml/schemas/` (used by TypeScript) and `internal/schema/schemas/` (used by Go):

- `posit-publishing-schema-v3.json` - Configuration schema
- `posit-publishing-record-schema-v3.json` - Deployment record schema

Non-breaking changes don't require version bumps. Update the schema file, corresponding example file, and verify unit tests pass.
