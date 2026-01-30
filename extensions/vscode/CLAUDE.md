# Project Overview

This is the Posit Publisher VSCode extension. It provides a sidebar UI for deploying Python and R projects to Posit Connect. The extension spawns a Go backend binary (`bin/publisher`) and communicates with it via HTTP API and Server-Sent Events.

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

- **Service** (`src/services.ts`) - Manages the Go binary subprocess lifecycle
- **EventStream** (`src/events.ts`) - SSE client receiving real-time updates from Go backend
- **PublisherState** (`src/state.ts`) - Central state management for credentials, configs, deployments
- **HomeViewProvider** (`src/views/homeView.ts`) - Main webview provider, bridges extension and Vue webview
- **API Client** (`src/api/`) - Axios-based HTTP client for Go backend communication
  - `client.ts` - Axios instance with interceptors for error handling and logging
  - `types/` - TypeScript types for API requests/responses
  - `resources/` - Resource-specific API methods (credentials, configurations, etc.)

## Views

- `views/homeView.ts` - Primary sidebar webview (Vue app in `webviews/homeView/`)
- `views/logs.ts` - Deployment log viewer
- `views/project.ts` - Project tree view
- `views/deployProgress.ts` - Deployment progress tracking

## Communication Flow

1. Extension ↔ Go Backend: HTTP REST API (via axios in `src/api/`)
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

# Debugging

- "Run Extension" - Debug extension only (auto-launches Go binary)
- "Run Extension using external API agent on 9001" - Debug both extension and Go backend simultaneously (requires launching Go debug session from repo root first)

Debug webviews using `Developer: Open Webview Developer Tools` command in the Extension Host window.
