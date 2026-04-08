# Project Overview

This is the Posit Publisher VSCode extension. It provides a sidebar UI for deploying Python and R projects to Posit Connect. The extension is in an active migration from a Go backend architecture to native TypeScript. Many operations now run directly in TypeScript, while some features still require the Go backend binary (`bin/publisher`) accessed via HTTP API and Server-Sent Events.

# Build Commands

```bash
# Full build (install deps, configure binary, package .vsix)
just

# Install npm dependencies (also installs webview deps)
just deps

# Run ESLint
just lint

# Run all tests (Mocha integration + Vitest unit)
just test

# Package extension to .vsix
just package

# Install packaged extension to VSCode
just install

# Uninstall extension
just uninstall
```

## Running in Development

1. Open this directory (`extensions/vscode/`) as the workspace in VSCode
2. Run the "Run Extension" debug configuration (F5)

If you modify Go backend code, run `just build` from the repo root first.
If you modify webviews, run `npm run build --prefix webviews/homeView` first.

## Testing

```bash
# Run all tests
just test

# Run only Vitest unit tests
npm run test-unit

# Run only Mocha integration tests (opens VSCode test instance)
npm test
```

Unit tests are in `src/**/*.test.ts` (excluding `src/test/`). Integration tests using VSCode APIs are in `src/test/`.

# Architecture

## Entry Point

`src/extension.ts` - Activates on workspace open, starts the Go binary as a subprocess, initializes views and event streams.

## Key Components

### TypeScript-Native Operations (no Go backend needed)

These modules run entirely in TypeScript and do not call the Go backend:

- **Bundler** (`src/bundler/`) - Creates deployment bundles (tar.gz archives) with manifest generation, file collection, and .gitignore filtering. Migrated from Go `internal/bundles/`.
- **TOML** (`src/toml/`) - Reads and writes configuration files (`.posit/publish/*.toml`) and deployment records (`.posit/publish/deployments/*.toml`) with JSON schema validation. Migrated from Go `internal/config/` and `internal/deployment/`.
- **Config Files** (`src/configFiles/`) - Configuration file discovery and management.
- **Interpreters** (`src/interpreters/`) - Detects Python/R versions via subprocess calls, scans Python packages (`pythonPackages.ts`) and R package lockfiles (`rPackages.ts`). Migrated from Go `internal/interpreters/`.
- **Credentials** (`src/credentials/`) - Manages credential storage via filesystem (`~/.connect-credentials`) or VSCode keychain. Partially migrated from Go `internal/credentials/`.
- **Dependencies** (`src/publish/dependencies.ts`) - Parses requirements.txt, pyproject.toml, renv.lock, DESCRIPTION for package dependencies. Migrated from Go `internal/bundles/`.
- **Project Files** (`src/projectFiles/`) - File tree building and .gitignore-aware file matching.

### Go Backend Integration (features still in Go)

These modules communicate with the Go backend via HTTP:

- **Service** (`src/services.ts`) - Manages the Go binary subprocess lifecycle
- **Server** (`src/servers.ts`) - Spawns and monitors the Go binary process
- **EventStream** (`src/events.ts`) - SSE client receiving real-time updates from Go backend
- **API Client** (`src/api/`) - Axios-based HTTP client for Go backend communication
  - `client.ts` - Axios instance with interceptors for error handling and logging
  - `types/` - TypeScript types for API requests/responses
  - `resources/` - Resource-specific API methods (deployment, inspection, Connect Cloud, Snowflake)

Features still accessed via Go backend: publishing/deployment, content inspection, Connect Cloud OAuth, Snowflake connections, SSE streaming.

### UI and State

- **PublisherState** (`src/state.ts`) - Central state management for credentials, configs, deployments
- **HomeViewProvider** (`src/views/homeView.ts`) - Main webview provider, bridges extension and Vue webview

## Views

- `views/homeView.ts` - Primary sidebar webview (Vue app in `webviews/homeView/`)
- `views/logs.ts` - Deployment log viewer
- `views/project.ts` - Project tree view
- `views/deployProgress.ts` - Deployment progress tracking

## Communication Flow

1. Extension ↔ Go Backend: HTTP REST API (via axios in `src/api/`) — for features not yet migrated
2. Go Backend → Extension: Server-Sent Events for real-time updates
3. Extension ↔ Webview: VSCode postMessage API (typed messages in `src/types/messages/`)

## Error Handling

The extension uses layered error handling with type-safe error discrimination:

**Error Types** (`src/utils/errorTypes.ts`):

- Defines `ErrorCode` enum with specific codes (e.g., `invalidTOML`, `deployFailed`, `credentialsCorrupted`)
- Factory function `mkErrorTypeGuard<T>()` creates type guards for each error type
- Each error type has: type definition, predicate (`isErr<Name>()`), and message formatter (`err<Name>Message()`)

**Go Backend Errors** (`src/api/types/error.ts`):

- `AgentError` types with `code`, `msg`, `operation` fields
- Type guards: `isAgentError()`, `isAgentErrorInvalidTOML()`, etc.

**Error Utilities** (`src/utils/errors.ts`):

- `getMessageFromError()` - Extract user-facing message from AxiosError, AgentError, or Error
- `getSummaryStringFromError(location, error)` - Build diagnostic message with context for logging
- `scrubErrorData()` - Remove sensitive fields before display

**Display Utilities** (`src/utils/window.ts`):

- `showErrorMessageWithTroubleshoot()` - Error message with troubleshooting docs link
- `showInformationMsg()` - Informational messages

**Pattern**: Use type guards to discriminate error types, extract user-friendly messages for UI, and include location context in logs.

## Multi-Step Inputs

`src/multiStepInputs/` contains wizard-style flows for credential creation, deployment setup, etc. These use VSCode's QuickPick and InputBox APIs.

See `webviews/homeView/CLAUDE.md` for Vue webview-specific documentation.

# Message Types

Extension-webview communication uses typed messages:

- `src/types/messages/hostToWebviewMessages.ts` - Extension → Webview
- `src/types/messages/webviewToHostMessages.ts` - Webview → Extension

# TypeScript Conventions

## Cross-Platform Path Handling

This extension runs on macOS, Linux, and Windows. Never construct file-system paths with hardcoded forward slashes — always use `path.join()`, `path.resolve()`, or VS Code's `Uri.joinPath()`.

**In production code:**

- Use `path.join("dir", "file.txt")` not `"dir/file.txt"`
- Use `path.dirname()`, `path.basename()`, `path.extname()` for path manipulation
- Use `Uri.file()` / `Uri.joinPath()` when working with VS Code APIs
- When a forward-slash path is needed for serialization (e.g., TOML config values), convert explicitly: `rel.split(path.sep).join("/")`

**In tests:**

- Build paths with `path.join()` and assert against `path.join()` results — never hardcode `"/project/foo"` literals as file-system paths
- For tests that touch the real filesystem, use `os.tmpdir()` + `fs.mkdtempSync()` for setup (see `bundler.test.ts`, `configWriter.test.ts` for good examples)
- TOML config patterns like `"/app.py"` are data values, not file-system paths — those are fine as string literals
**In tests:**

- Build paths with `path.join()` and assert against `path.join()` results — never hardcode `"/project/foo"` literals as file-system paths
- For tests that touch the real filesystem, use `os.tmpdir()` + `fs.mkdtempSync()` for setup (see `bundler.test.ts`, `configWriter.test.ts` for good examples)
- TOML config patterns like `"/app.py"` are data values, not file-system paths — those are fine as string literals
- Whenever possible, test paths with spaces (other relevant non-ascii characters) to ensure that our path operations are compatible across shells and systems.
## Avoid Type Assertions

Do not use TypeScript [type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions) (`as Type`) unless there is no alternative. Type assertions bypass the compiler's type checking and can hide bugs. Instead, prefer:

- **Type guards** (`if ('prop' in obj)`, `instanceof`, or custom type guard functions) to narrow types safely
- **Type annotations** on variables and parameters to declare types upfront
- **Generic type parameters** to propagate types through functions and APIs

If a type assertion is truly unavoidable (e.g., working around a third-party API with incomplete types), add a comment explaining why.

# Debugging

- "Run Extension" - Debug extension only (auto-launches Go binary)
- "Run Extension using external API agent on 9001" - Debug both extension and Go backend simultaneously (requires launching Go debug session from repo root first)

Debug webviews using `Developer: Open Webview Developer Tools` command in the Extension Host window.
