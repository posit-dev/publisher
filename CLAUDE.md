# Project Overview

Posit Publisher is a VSCode/Positron extension that enables deploying Python and R projects to Posit Connect. The project is in an active Go-to-TypeScript migration, with a hybrid architecture:

- **Go backend** (`cmd/publisher/`, `internal/`) - API server handling credential CRUD, Connect Cloud/Snowflake publishing, and SSE streaming. Still required at runtime for these features only.
- **TypeScript packages** (`packages/`) - Shared TypeScript libraries consumed by the extension for Connect API communication (`connect-api`) and Connect Cloud OAuth (`connect-cloud-api`)
- **VSCode extension** (`extensions/vscode/`) - TypeScript extension providing the UI and handling most operations directly (publishing to standard Connect, bundling, content inspection, TOML handling, interpreter detection, dependency analysis, Connect Cloud OAuth, Snowflake discovery)
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
| Python package scanning                | `extensions/vscode/src/interpreters/scanPythonDependencies.ts`                | Go POST `/packages/python/scan`            |
| Dependency analysis                    | `extensions/vscode/src/publish/dependencies.ts`                               | `internal/bundles/`                        |
| Project file tree                      | `extensions/vscode/src/projectFiles/`                                         | N/A (new)                                  |
| Credential storage                     | `extensions/vscode/src/credentials/`                                          | `internal/credentials/` (partially)        |
| Content inspection/detection           | `extensions/vscode/src/inspect/`                                              | `internal/inspect/`                        |
| Publishing to standard Connect         | `extensions/vscode/src/publish/connectPublish.ts`                             | `internal/publish/`                        |
| Connect Cloud OAuth flows              | Uses `@posit-dev/connect-cloud-api` package directly                          | `internal/cloud/`                          |
| Snowflake connection discovery         | `extensions/vscode/src/snowflake/`                                            | `internal/clients/`                        |

The standard Connect publish path runs entirely in TypeScript via `connectPublish()` using `@posit-dev/connect-api`. A gate function `canUseTsPublishPath()` in `src/views/canUseTsPublishPath.ts` routes deployments to either the TS or Go path based on server type and config options.

The following features are **still in Go** and accessed via the Go backend HTTP API:

| Feature                                | Go API Route                                        | Extension API Wrapper                 |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| Publishing (Connect Cloud / Snowflake) | `POST /deployments/{name}`                          | `src/api/resources/ContentRecords.ts` |
| Publishing with `packagesFromLibrary`  | `POST /deployments/{name}`                          | `src/api/resources/ContentRecords.ts` |
| Deployment cancellation (Go path only) | `POST /deployments/{name}/cancel/{localid}`         | `src/api/resources/ContentRecords.ts` |
| Credential creation (with validation)  | `POST /credentials`                                 | `src/api/resources/Credentials.ts`    |
| Credential deletion                    | `DELETE /credentials/{guid}`, `DELETE /credentials` | `src/api/resources/Credentials.ts`    |
| Server-Sent Events streaming (Go path) | `GET /events`                                       | `src/events.ts`                       |

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
│   ├── Content inspection/detection (src/inspect/)
│   ├── Publishing to standard Connect (src/publish/connectPublish.ts)
│   ├── Connect Cloud OAuth (via @posit-dev/connect-cloud-api)
│   ├── Snowflake connection discovery (src/snowflake/)
│   └── Credential storage (filesystem / VSCode keychain)
│
└── Go Backend Operations (via HTTP API — 5 routes remain):
    ├── Publishing for Connect Cloud / Snowflake server types
    ├── Publishing with packagesFromLibrary config option
    ├── Credential creation (POST) and deletion (DELETE)
    └── Server-Sent Events for Go publish path progress
```

## Go Backend (`internal/`)

Key packages (still actively used by remaining Go API routes):

- `services/api/` - HTTP API endpoints (5 routes remain: credential CRUD, Go publish path, SSE)
- `publish/` - Publishing logic for Connect Cloud and Snowflake deployments
- `clients/` - HTTP clients for Connect API communication (used by Go publish path)
- `credentials/` - Credential creation/deletion API (storage migrated, CRUD routes remain)
- `events/` - Server-Sent Events for Go publish path progress updates

Legacy packages (functionality fully migrated to TypeScript, Go code still present):

- `accounts/` - Server account management (used by Go publish path internally)
- `bundles/` - Deployment bundle creation and manifest generation
- `cloud/` - Connect Cloud OAuth (migrated to `@posit-dev/connect-cloud-api`)
- `config/` - Configuration file parsing (`.posit/publish/*.toml`)
- `deployment/` - Deployment record management
- `inspect/` - Project inspection (migrated to `extensions/vscode/src/inspect/`)
- `interpreters/` - Python/R interpreter detection and version management
- `schema/` - JSON schemas for configuration validation

The CLI entry point (`cmd/publisher/main.go`) uses [Kong](https://github.com/alecthomas/kong) for command parsing. The `ui` command starts an HTTP API server that the VSCode extension communicates with.

## TypeScript Packages (`packages/`)

Shared npm packages consumed by the extension for Connect API communication:

- `packages/connect-api/` - TypeScript client for the Posit Connect REST API (axios-based). Used by `connectPublish.ts` for standard Connect deployments and by Snowflake discovery for authentication validation.
- `packages/connect-cloud-api/` - TypeScript client for Connect Cloud API with OAuth authentication. Used by the Connect Cloud credential flow for device auth and account management.

## VSCode Extension (`extensions/vscode/src/`)

Key areas:

- **Bundler** (`src/bundler/`) - Creates deployment bundles (tar.gz) with manifest generation, file collection, and .gitignore filtering
- **TOML** (`src/toml/`) - Reads/writes configuration and deployment TOML files with schema validation
- **Inspect** (`src/inspect/`) - Content inspection/detection with detectors for Python, R, Quarto, HTML, notebooks, Plumber, and R Markdown
- **Interpreters** (`src/interpreters/`) - Detects Python/R versions and scans packages
- **Credentials** (`src/credentials/`) - Manages credential storage (filesystem or VSCode keychain)
- **Publish** (`src/publish/`) - Publishing orchestration (`connectPublish.ts`) and dependency analysis for Python/R projects
- **Snowflake** (`src/snowflake/`) - Snowflake connection discovery, config parsing, and token providers
- **API** (`src/api/`) - Axios HTTP client for Go backend communication (credential CRUD and Go publish path only)
- **Views** (`src/views/`) - Sidebar webview and tree view providers; includes `canUseTsPublishPath.ts` which gates TS vs Go publish
- **Servers** (`src/servers.ts`) - Go binary subprocess management (still needed for remaining Go API routes)
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

# Finding Dead Go Code with `deadcode`

Use [`deadcode`](https://pkg.go.dev/golang.org/x/tools/cmd/deadcode) to find unreachable Go code during migration cleanup.

```bash
go install golang.org/x/tools/cmd/deadcode@latest

# Production reachability from main() only (use this for cleanup)
deadcode ./... 2>&1 | grep -E "^internal/" | grep -v mock | grep -v Mock | grep -v "_test\.go" | grep -v "test"
```

## Important caveats

- **Always verify with grep before deleting.** A function reported as unreachable from `main()` may still be called by tests. Deleting it is correct from a production standpoint but will break tests. Check each one: `grep -r "FuncName" internal/ --include="*.go"` — if only `_test.go` files call it, decide whether to remove the function and update the tests, or leave it.
- **Transitively dead code is real.** If function A calls function B, and only A is dead, then B may appear live. Remove A first, re-run `deadcode`, and B will surface. Use an iterative approach.
- **HTTP route registration keeps code alive.** An endpoint registered in the router is reachable from `main()`. Remove the route first, then re-run to find what it was keeping alive.
- **Filter out vendor/ and node_modules/.** Vendored code always has unreachable functions — that's normal.
- **`deadcode -test`** considers test entry points too, which hides test-only functions. Use `deadcode ./...` (without `-test`) for cleanup work.
