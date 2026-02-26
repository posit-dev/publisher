# Proof of Concept: Configuration Domain

This document explains the proof-of-concept implementation in `packages/core/`
and how it demonstrates the hexagonal architecture migration plan described in
`TS_MIGRATION_PLAN.md`.

## What this proves

1. **The core package has zero dependencies on infrastructure.** It imports
   nothing from Node.js, VS Code, axios, or any TOML library. All external
   interaction is defined through port interfaces.

2. **The core is testable in isolation.** Tests use `node:test` + `node:assert`
   with simple fakes — no mocking frameworks, no VS Code test runner, no
   bundler. Tests run in ~40ms.

3. **The extension can consume the core without npm workspaces.** A TypeScript
   `paths` mapping in `extensions/vscode/tsconfig.json` lets the extension
   import from `@publisher/core`. esbuild follows the path and bundles the
   core into the extension's single output file. This avoids `vsce` packaging
   issues that npm workspaces would introduce.

4. **Domain logic lives in the core, not in adapters.** The `SaveConfiguration`
   use case enforces product type compliance *before* writing to the store.
   This logic (ported from Go's `ForceProductTypeCompliance`) runs regardless
   of which adapter backs the store.

5. **Partial failures are handled gracefully.** `ListConfigurations` reads all
   configs for a project and collects parse errors alongside successes, rather
   than failing entirely. This matches the current Go API behavior.

## File layout

```
packages/core/
├── package.json                              # Standalone package, ESM
├── tsconfig.json                             # NodeNext modules, strict
├── src/
│   ├── index.ts                              # Public API barrel
│   ├── core/
│   │   ├── types.ts                          # Domain types (Configuration, ContentType, etc.)
│   │   ├── errors.ts                         # Domain error classes
│   │   ├── ports.ts                          # ConfigurationStore interface
│   │   └── product-type-compliance.ts        # Pure function (ported from Go)
│   └── use-cases/
│       ├── list-configurations.ts            # List with partial error collection
│       ├── get-configuration.ts              # Single config read
│       └── save-configuration.ts             # Save with compliance enforcement
└── test/
    └── core/
        ├── list-configurations.test.ts       # 4 tests
        └── save-configuration.test.ts        # 5 tests
```

## How it maps to the hexagonal architecture

### Core (this PoC)

The core defines:

- **Domain types** (`types.ts`) — `Configuration`, `ContentType`,
  `ProductType`, and all nested config structures. These are pure TypeScript
  interfaces with no dependencies.

- **Domain errors** (`errors.ts`) — `ConfigurationNotFoundError`,
  `ConfigurationReadError`, `ConfigurationValidationError`. Adapters translate
  infrastructure errors into these types.

- **Port interface** (`ports.ts`) — `ConfigurationStore` with four methods:
  `list`, `read`, `write`, `remove`. This is designed for the core's needs,
  not shaped by the Go API's REST endpoints.

- **Use cases** — Classes with an `execute` method that receive ports as
  parameters (following the hexatype pattern). Each use case represents a
  single user-facing operation.

### Driven adapter (not yet implemented)

A driven adapter would implement `ConfigurationStore` by reading/writing TOML
files on the filesystem. It would:

- Use a TOML library to parse and serialize configurations
- Translate filesystem errors (`ENOENT`, `EACCES`) into domain errors
- List `.toml` files in `.posit/publish/` to implement `list()`
- Live in `packages/adapters/`, not in the core or the extension — driven
  adapters like this are platform-independent and reusable by any driving
  adapter (VS Code extension, CLI, etc.)

### Driving adapter (not yet wired)

The VS Code extension is the driving adapter. It would:

- Construct a `ConfigurationStore` adapter at startup
- Call use cases like `new ListConfigurations().execute(store, projectDir)`
- Format results for the UI (webview messages, tree views, etc.)

## Key design decisions

### Port interface is simpler than the Go API

The Go API has separate endpoints for configuration files, secrets, packages,
and integration requests nested under `/configurations/{name}/...`. The port
interface is just `list`/`read`/`write`/`remove` — the core doesn't need to
know about sub-resources at the storage level.

### TOML is an adapter concern

The core never mentions TOML. The `ConfigurationStore` port accepts and
returns `Configuration` objects. Serialization format is the adapter's
responsibility. This means the core could be backed by TOML files, a
database, or an in-memory store (as the tests demonstrate) without changes.

### No npm workspaces

The extension references the core via a TypeScript `paths` mapping:

```json
// extensions/vscode/tsconfig.json
"paths": {
  "src/*": ["./src/*"],
  "@publisher/core": ["../../packages/core/src/index.ts"]
}
```

esbuild follows this path when bundling, producing a single `dist/extension.js`
that includes the core. The `vsce` packager sees no workspace dependencies.

### Tests use inline fakes

Following the hexatype pattern, test doubles are defined directly in test
files rather than in a shared test-utils directory. Each test file creates
the fakes it needs:

- `FakeConfigurationStore` — in-memory map with optional error injection
- `RecordingConfigurationStore` — captures `write` calls for assertion

This keeps tests self-contained and makes the expected behavior obvious.

## Running it

```bash
# Build and test the core package
cd packages/core
npm install
npm run build-and-test

# Verify the extension still type-checks
cd extensions/vscode
npm install
npx tsc --noEmit

# Verify the extension still bundles
npm run esbuild
```

## What comes next

See `TS_MIGRATION_PLAN.md` for the full migration plan. The next steps after
this PoC are:

1. Resolve open questions (SSE, credential storage, TOML handling, migration
   approach)
2. Implement a driven adapter for `ConfigurationStore` backed by the filesystem
3. Wire the extension to call the core use cases instead of the Go API for
   configuration operations
4. Expand to the next domain: deployment records
