# Project Overview

Posit Publisher is a VSCode/Positron extension that enables deploying Python and R projects to Posit Connect. The project consists of:

- **Go backend** (`cmd/publisher/`, `internal/`) - API server that handles deployments, configuration, and Connect server communication
- **VSCode extension** (`extensions/vscode/`) - TypeScript extension providing the UI
- **Webviews** (`extensions/vscode/webviews/homeView/`) - Vue 3 UI components for the extension sidebar

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

## Go Backend (`internal/`)

Key packages:

- `accounts/` - Server account/credential management
- `bundles/` - Deployment bundle creation and manifest generation
- `clients/` - HTTP clients for Connect API communication
- `config/` - Configuration file parsing (`.posit/publish/*.toml`)
- `credentials/` - Credential storage (keyring or file-based)
- `deployment/` - Deployment record management (`.posit/publish/deployments/`)
- `events/` - Server-Sent Events for real-time UI updates
- `inspect/` - Project inspection (detect Python/R/Quarto content)
- `interpreters/` - Python/R interpreter detection and version management
- `publish/` - Core publishing logic to Connect servers
- `schema/` - JSON schemas for configuration validation

The CLI entry point (`cmd/publisher/main.go`) uses [Kong](https://github.com/alecthomas/kong) for command parsing. The `ui` command starts an HTTP API server that the VSCode extension communicates with.

## VSCode Extension (`extensions/vscode/src/`)

The extension spawns the Go binary as a subprocess and communicates via HTTP API. Key areas:

- Views and webviews for the sidebar UI
- File watchers for configuration changes
- Authentication provider for Connect credentials

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
- Mock files follow `*_mock.go` or `mock_*.go` naming

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

Schemas in `internal/schema/schemas/`:

- `posit-publishing-schema-v3.json` - Configuration schema
- `posit-publishing-record-schema-v3.json` - Deployment record schema

Non-breaking changes don't require version bumps. Update the schema file, corresponding example file, and verify unit tests pass.

# TypeScript Core Migration

This project is being migrated from a Go REST API backend to an in-process
TypeScript core package using hexagonal architecture (ports and adapters).

- **Plan document:** `TS_MIGRATION_PLAN.md` — records inventory, decisions,
  port interface designs, and migration progress.
- **Reference implementation:** https://github.com/christierney/hexatype
  demonstrates the pattern at small scale. See its `DESIGN.md` for the
  architectural principles and `PLAN.md` for the migration playbook.

## Hexagonal Architecture Summary

- **Core package** (`packages/core/`): Domain types, port interfaces, use
  cases. No dependencies on Node.js APIs, VS Code APIs, or HTTP libraries.
- **Driven ports**: Interfaces the core uses to access external resources
  (Connect API, file system, credentials, interpreters).
- **Driven adapters**: Implementations of ports (in the extension, not the
  core). Each adapter translates between infrastructure and domain types.
- **Driving adapters**: The VS Code extension (and potentially a CLI) that
  calls use cases.
- **Test through ports**: Use fakes implementing port interfaces. No mocking
  frameworks required for core tests.

## Key Patterns (from hexatype reference)

- Port interfaces use TypeScript `interface`, not abstract classes
- Use cases receive ports via constructor injection or method parameters
- Domain errors are specific types; adapters translate infrastructure errors
- Adapters are thin — they translate types and delegate, no business logic
- The core has zero external dependencies
- Tests use `node:test` + `node:assert` (no test framework dependency)
- The adapter-level `HttpClient` interface is a port *at the adapter level*,
  not a core port — this keeps HTTP concerns fully outside the core
