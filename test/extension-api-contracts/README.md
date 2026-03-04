# Extension API Contract Tests

Contract tests that validate which **VSCode and Positron APIs** the extension calls, with what arguments, and what it expects back. These tests mock the `vscode` and `positron` modules, import actual extension code against those mocks, and assert API interactions.

## Architecture

```
Test code  →  Import real extension module  →  Mock vscode/positron APIs
               (e.g., src/dialogs.ts)           (vi.fn() spies record calls)
```

No Go binary, no HTTP server, no network. Tests run entirely in-process using Vitest with module aliasing to intercept `vscode` and `positron` imports.

## What's tested

Each test file captures the contract between extension code and the VSCode/Positron API surface:

| Test File | Extension Source | APIs Validated |
|-----------|-----------------|----------------|
| `positron-settings` | `utils/positronSettings.ts` | `workspace.getConfiguration("positron.r")` |
| `extension-settings` | `extension.ts` | `workspace.getConfiguration("positPublisher")` |
| `dialogs` | `dialogs.ts` | `window.showInformationMessage` (modal), `l10n.t` |
| `window-utils` | `utils/window.ts` | `window.showErrorMessage`, `withProgress`, `createTerminal` |
| `interpreter-discovery` | `utils/vscode.ts` | `commands.executeCommand`, `workspace.getConfiguration`, Positron runtime |
| `file-watchers` | `watchers.ts` | `workspace.createFileSystemWatcher`, `RelativePattern` |
| `llm-tools` | `llm/index.ts` | `lm.registerTool` |
| `open-connect` | `open_connect.ts` | `window.showInputBox`, `workspace.updateWorkspaceFolders` |
| `auth-provider` | `authProvider.ts` | `authentication.registerAuthenticationProvider` |
| `connect-filesystem` | `connect_content_fs.ts` | `workspace.registerFileSystemProvider`, `FileSystemError` |
| `document-tracker` | `entrypointTracker.ts` | Editor/document change events, `commands.executeCommand("setContext")` |
| `activation` | `extension.ts` | `activate()` wiring: trust, URI handler, commands, contexts |

## Mock design

### `src/mocks/vscode.ts`
Comprehensive mock of the `vscode` module with `vi.fn()` spies for all APIs the extension uses. Includes constructors (`Disposable`, `EventEmitter`, `Uri`, `RelativePattern`, etc.), enums (`FileType`, `ProgressLocation`, etc.), and namespace objects (`commands`, `window`, `workspace`, `authentication`, `lm`, `l10n`).

### `src/mocks/positron.ts`
Mock of the `positron` module providing `acquirePositronApi()` and the `LanguageRuntimeMetadata` type.

## Running

```bash
# Install dependencies (first time)
cd test/extension-api-contracts && npm install

# Run tests
just test-extension-contracts

# Or directly
cd test/extension-api-contracts && npx vitest run

# Watch mode
cd test/extension-api-contracts && npx vitest
```

## Adding a new contract test

1. Create a new file in `src/contracts/` following the naming convention: `<feature>.test.ts`
2. Import `vi` from `vitest` and the relevant `vscode` APIs from the mock
3. Mock any internal dependencies with `vi.mock("src/...")`
4. Import the extension module under test with `await import("src/...")`
5. Write tests that call extension functions and assert which VSCode APIs were invoked

## Related test suites

- Extension unit tests (`extensions/vscode/src/**/*.test.ts`) — Test internal logic
- E2E tests (`test/e2e/`) — Full integration with Docker
