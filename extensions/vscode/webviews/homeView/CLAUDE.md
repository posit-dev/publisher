# Project Overview

This is the Home View webview for the Posit Publisher VSCode extension. It's a Vue 3 application that renders the main sidebar UI, built with Vite and using Pinia for state management.

# Build Commands

```bash
# Build for production (outputs to dist/)
npm run build

# Run tests with coverage
npm test

# Install dependencies
npm install
# or via just:
just deps
```

The built output (`dist/`) is loaded by the parent VSCode extension.

## Development Workflow

The webview does NOT support hot reload. To see changes:

1. Edit code in `src/`
2. Rebuild: `npm run build`
3. Reload extension: Close Extension Host window and press F5 again

This is required because the extension loads static files from `dist/` via VSCode URIs, not a dev server.

# Architecture

## Entry Point

- `src/main.ts` - Vue app initialization, mounts to `#app`
- `src/App.vue` - Root component
- `index.html` - HTML template (Vite entry)

## State Management

Pinia stores in `src/stores/`:

- `home.ts` - Main application state (credentials, configs, deployments, publish status)
- `file.ts` - File listing state for deployment file selection

## Host Communication

`src/HostConduitService.ts` - Singleton service that manages bidirectional communication with the VSCode extension host via `postMessage`.

Message types are defined in the parent extension:

- `../../../src/types/messages/hostToWebviewMessages.ts` - Messages from extension
- `../../../src/types/messages/webviewToHostMessages.ts` - Messages to extension

The `useHostConduitService()` composable provides `sendMsg()` and subscribes to incoming messages on mount.

## Adding Message Types

To add a new message type for extension ↔ webview communication:

### Host → Webview Message

1. **Define type** in `../../../src/types/messages/hostToWebviewMessages.ts`:
   - Add enum value to `HostToWebviewMessageType`
   - Define content type (if payload needed)
   - Add to `HostToWebviewMessage` union
   - Add to `isHostToWebviewMessage()` type guard

2. **Send from extension** in `../../../src/views/homeView.ts`:

   ```typescript
   this.webviewConduit.sendMsg({
     kind: HostToWebviewMessageType.MY_MESSAGE,
     content: {
       /* typed payload */
     },
   });
   ```

3. **Handle in webview** in `src/HostConduitService.ts`:
   - Add case to `onMessageFromHost()` switch statement
   - Update Pinia store or trigger UI updates

### Webview → Host Message

Same pattern in reverse:

1. Define in `webviewToHostMessages.ts`
2. Send via `useHostConduitService().sendMsg()`
3. Handle in `homeView.ts` `onConduitMessage()` switch

### Files to Modify

| Direction      | Type Definition            | Sender                  | Handler                 |
| -------------- | -------------------------- | ----------------------- | ----------------------- |
| Host → Webview | `hostToWebviewMessages.ts` | `homeView.ts`           | `HostConduitService.ts` |
| Webview → Host | `webviewToHostMessages.ts` | `HostConduitService.ts` | `homeView.ts`           |

## Components

`src/components/`:

- `EvenEasierDeploy.vue` - Main deployment interface
- `views/` - Sub-views for different UI states
- `tree/` - Tree view components for file/package lists
- UI primitives: `DeployButton`, `ProcessProgress`, `ActionToolbar`, etc.

## Styling

- Uses `@vscode/webview-ui-toolkit` for VSCode-native components (prefixed `vscode-*`)
- Custom elements with `vscode-` prefix are registered in `vite.config.ts` compiler options
- Global styles in `src/style.css`
- SCSS support via `sass-embedded`

# Testing

Tests use Vitest with jsdom environment. Coverage thresholds are enforced in CI.

```bash
# Run tests
npm test

# Coverage report is generated in coverage/
```

Test files are colocated with source (`*.test.ts`). Test utilities in `src/test/`.

# VSCode API Access

`src/vscode.ts` - Wrapper for `acquireVsCodeApi()` which provides the postMessage interface. This is the only way to communicate with the extension host.
