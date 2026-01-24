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

# Schema Updates

Schemas in `internal/schema/schemas/`:

- `posit-publishing-schema-v3.json` - Configuration schema
- `posit-publishing-record-schema-v3.json` - Deployment record schema

Non-breaking changes don't require version bumps. Update the schema file, corresponding example file, and verify unit tests pass.
