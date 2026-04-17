# Project Overview

This is the Posit Publisher VSCode extension — a pure TypeScript VSCode/Positron extension that provides a sidebar UI for deploying Python and R projects to Posit Connect and Connect Cloud.

# Build Commands

```bash
# Full build (install deps, configure, package .vsix)
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

`src/extension.ts` — Activates on workspace open, initializes views, event stream, watchers, and state.

## Key Components

- **Bundler** (`src/bundler/`) — Creates deployment bundles (tar.gz archives) with manifest generation, file collection, and .gitignore filtering.
- **TOML** (`src/toml/`) — Reads and writes configuration files (`.posit/publish/*.toml`) and deployment records (`.posit/publish/deployments/*.toml`) with JSON schema validation.
- **Config Files** (`src/configFiles/`) — Configuration file discovery and management.
- **Inspect** (`src/inspect/`) — Content inspection/detection with detectors for Python, R, Quarto, HTML, notebooks, Plumber, and R Markdown.
- **Interpreters** (`src/interpreters/`) — Detects Python/R versions via subprocess calls, scans Python packages and R package lockfiles.
- **Credentials** (`src/credentials/`) — Manages credential storage via filesystem (`~/.connect-credentials`) or VSCode keychain.
- **Publish** (`src/publish/`) — Publishing orchestration (`connectPublish.ts`) and dependency analysis for Python/R projects. Publishes to standard Connect via `@posit-dev/connect-api` and to Connect Cloud via `@posit-dev/connect-cloud-api`.
- **Snowflake** (`src/snowflake/`) — Snowflake connection discovery, config parsing, and token providers.
- **Project Files** (`src/projectFiles/`) — File tree building and .gitignore-aware file matching.
- **EventStream** (`src/events.ts`) — In-process event emitter used to drive the logs view and deploy progress.
- **API types** (`src/api/types/`) — Domain type definitions for Connect/Connect Cloud/credentials/deployments. The `src/api/` directory name is historical (it used to host a Go-backend HTTP client); today it holds type definitions only.

### UI and State

- **PublisherState** (`src/state.ts`) - Central state management for credentials, configs, deployments
- **HomeViewProvider** (`src/views/homeView.ts`) - Main webview provider, bridges extension and Vue webview

## Views

- `views/homeView.ts` - Primary sidebar webview (Vue app in `webviews/homeView/`)
- `views/logs.ts` - Deployment log viewer
- `views/project.ts` - Project tree view
- `views/deployProgress.ts` - Deployment progress tracking

## Communication Flow

Extension ↔ Webview: VSCode postMessage API (typed messages in `src/types/messages/`).

## Error Handling

The extension uses layered error handling with type-safe error discrimination:

**Error Types** (`src/utils/errorTypes.ts`):

- Defines `ErrorCode` enum with specific codes (e.g., `invalidTOML`, `deployFailed`, `credentialsCorrupted`)
- Factory function `mkErrorTypeGuard<T>()` creates type guards for each error type
- Each error type has: type definition, predicate (`isErr<Name>()`), and message formatter (`err<Name>Message()`)

**Structured Errors** (`src/api/types/error.ts`):

- `AgentError` types with `code`, `msg`, `operation` fields (shared with event stream messages)
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

## R Subprocess Expressions

The extension spawns R subprocesses via `execFile(rPath, ["-s", "-e", expression])` (see `src/publish/rLibraryMapper.ts`). Windows R's `-e` flag does not support multi-line strings — it fails with `"unexpected end of input"`. To avoid this:

- **Keep R expressions on a single line.** Join multiple statements with semicolons (`;`) instead of newlines.
- **Escape user-controlled values** interpolated into R code with `escapeForRString()` to prevent code injection via crafted directory paths or repository names/URLs.
- **Use `-s`** (silent/no-save) for clean output with no startup noise.
- **Set a generous `maxBuffer`** — commands like `available.packages()` for CRAN can exceed Node's default 1 MB buffer.

```typescript
// Good — single-line with semicolons
const code = `x <- 1; y <- 2; cat(x + y)`;

// Bad — multi-line breaks on Windows R
const code = `
x <- 1
y <- 2
cat(x + y)
`;
```

# Debugging

- "Run Extension" — Launch the extension in a VSCode Extension Development Host.

Debug webviews using `Developer: Open Webview Developer Tools` command in the Extension Host window.
