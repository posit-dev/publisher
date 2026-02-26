# Proof of Concept: Configuration Domain

This document explains the proof-of-concept implementation in `packages/core/`,
`packages/adapters/`, and the Go API migration adapter in
`extensions/vscode/src/adapters/`, and how they demonstrate the hexagonal
architecture migration plan described in `TS_MIGRATION_PLAN.md`.

## What this proves

1. **The core package has zero dependencies on infrastructure.** It imports
   nothing from Node.js, VS Code, axios, or any TOML library. All external
   interaction is defined through port interfaces.

2. **The core is testable in isolation.** Tests use `node:test` + `node:assert`
   with simple fakes — no mocking frameworks, no VS Code test runner, no
   bundler. Tests run in ~40ms.

3. **Adapters translate between infrastructure and domain.** The
   `FsConfigurationStore` adapter handles TOML parsing, snake_case/camelCase
   key translation, and filesystem error mapping — none of which the core
   knows about.

4. **The extension can consume both packages without npm workspaces.** TypeScript
   `paths` mappings in `extensions/vscode/tsconfig.json` let the extension
   import from `@publisher/core` and `@publisher/adapters`. esbuild follows
   the paths and bundles everything into a single output file. `vsce` sees no
   workspace dependencies.

5. **Domain logic lives in the core, not in adapters.** The `SaveConfiguration`
   use case enforces product type compliance *before* writing to the store.
   This logic (ported from Go's `ForceProductTypeCompliance`) runs regardless
   of which adapter backs the store.

6. **Partial failures are handled gracefully.** `ListConfigurations` reads all
   configs for a project and collects parse errors alongside successes, rather
   than failing entirely. This matches the current Go API behavior.

7. **Adapters are reusable across driving adapters.** `FsConfigurationStore`
   lives in `packages/adapters/`, not in the extension. A CLI could use the
   same adapter without depending on VS Code APIs.

8. **The migration can be incremental.** `GoApiConfigurationStore` implements
   the same `ConfigurationStore` port by delegating to the existing Go backend
   REST API. The extension can be wired through the port interface *today*,
   while still using the Go backend. When the Go backend is decommissioned,
   the adapter is deleted and replaced by `FsConfigurationStore` — no other
   code changes required.

9. **Type translation between old and new is contained in the adapter.** The
   Go API adapter handles the mismatch between the extension's existing enum
   types and the core's string union types, optional-vs-required field
   differences, and axios error mapping. These translation costs are isolated
   in one file and disappear when the adapter is deleted.

## File layout

```
packages/core/                                    # Zero dependencies
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                                  # Public API barrel
│   ├── core/
│   │   ├── types.ts                              # Domain types
│   │   ├── errors.ts                             # Domain error classes
│   │   ├── ports.ts                              # ConfigurationStore interface
│   │   └── product-type-compliance.ts            # Pure function (ported from Go)
│   └── use-cases/
│       ├── list-configurations.ts                # List with partial error collection
│       ├── get-configuration.ts                  # Single config read
│       └── save-configuration.ts                 # Save with compliance enforcement
└── test/core/
    ├── list-configurations.test.ts               # 4 tests with FakeConfigurationStore
    └── save-configuration.test.ts                # 5 tests with RecordingConfigurationStore

packages/adapters/                                # Has dependencies (smol-toml)
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                                  # Public API barrel
│   ├── fs-configuration-store.ts                 # ConfigurationStore → TOML files
│   └── key-transform.ts                          # snake_case ↔ camelCase
└── test/
    └── fs-configuration-store.test.ts            # 13 tests against real temp dirs

extensions/vscode/src/adapters/                   # Migration adapter (temporary)
└── goApiConfigurationStore.ts                    # ConfigurationStore → Go REST API
```

## How it maps to the hexagonal architecture

### Core (`packages/core/`)

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

### Driven adapter (`packages/adapters/`)

`FsConfigurationStore` implements the `ConfigurationStore` port by
reading/writing TOML files in `.posit/publish/`. It handles:

- **TOML parsing and serialization** using `smol-toml`
- **Key translation** — TOML files use snake_case (`package_file`), domain
  types use camelCase (`packageFile`)
- **Error translation** — `ENOENT` → `ConfigurationNotFoundError`, TOML
  parse failure → `ConfigurationReadError`
- **Directory creation** — creates `.posit/publish/` on write if missing

The adapter is tested against real temporary directories (not mocks),
verifying actual file I/O behavior including round-trip fidelity.

### Migration adapter (`extensions/vscode/src/adapters/`)

`GoApiConfigurationStore` implements the same `ConfigurationStore` port, but
delegates to the existing Go backend REST API instead of the filesystem. It
demonstrates the incremental migration strategy:

- **Type translation** — The Go API response types use TypeScript enums
  (`ContentType.HTML`, `ProductType.CONNECT`) and required fields, while the
  core uses string unions (`"html"`, `"connect"`) and optional fields. The
  adapter handles these mismatches with explicit casts and defaults.
- **Error translation** — Axios errors (404, network failures) are mapped to
  domain errors (`ConfigurationNotFoundError`, `ConfigurationReadError`).
- **Envelope unwrapping** — The Go API wraps config details in a location
  envelope (`configurationName`, `configurationPath`, `projectDir`). The
  adapter extracts the details for the core domain type.

This adapter lives in the extension (not in `packages/adapters/`) because it
depends on the extension's axios-based API client. It is explicitly temporary
— once the Go backend is decommissioned, this file is deleted and the
extension switches to `FsConfigurationStore`.

### Driving adapter (the extension)

The VS Code extension would wire it up like this:

```typescript
import { ListConfigurations } from "@publisher/core";
import { FsConfigurationStore } from "@publisher/adapters";

// Wire the adapter (once, at startup)
const configStore = new FsConfigurationStore();

// Use it from a command handler or view provider
const listConfigs = new ListConfigurations();
const configs = await listConfigs.execute(configStore, projectDir);

// Format for the UI
for (const entry of configs) {
  if ("configuration" in entry) {
    // Show the config in the sidebar
  } else {
    // Show the error badge
  }
}
```

No DI container, no factory pattern — just direct construction and method
calls. The extension is responsible for choosing which adapters to create
and passing them to use cases.

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
database, or an in-memory store (as the core tests demonstrate) without
changes.

### `packages/adapters/` is separate from `packages/core/`

The core has zero dependencies. The adapters package can take infrastructure
dependencies (TOML library, HTTP clients, etc.) without affecting the core.
This separation also makes the dependency direction clear: adapters depend
on the core, never the reverse.

### Inter-package references use different strategies

- **adapters → core:** `"@publisher/core": "file:../core"` in package.json
  creates a symlink, which works for both TypeScript compilation and Node.js
  test runtime.
- **extension → core/adapters:** TypeScript `paths` mappings point at source
  files. esbuild follows the paths when bundling. No `file:` dependency
  needed because the extension never runs the packages directly — it bundles
  them.

### The migration adapter enables incremental switchover

Rather than a big-bang replacement of the Go backend, the migration can
proceed one use case at a time:

1. Wire the extension to call a core use case through `GoApiConfigurationStore`
2. Verify behavior is unchanged (the Go backend still does the actual work)
3. Swap `GoApiConfigurationStore` for `FsConfigurationStore`
4. Remove the Go API call site

Because both adapters implement the same port interface, step 3 is a
one-line change at the wiring site. The core use cases, domain logic, and
UI code are unaffected.

### Extension types consolidate during migration

The extension currently has its own types (`ContentType` enum,
`ConfigurationDetails`, `ScheduleConfig`, etc.) that mirror the Go API
response shapes. During migration, extension code that calls core use cases
receives core domain types directly. As each call site migrates, the Go API
types become unused and can be deleted. By the end of the migration, the
extension uses core domain types everywhere — no translation layer, no
duplicate type definitions.

### Tests use inline fakes (core) and real I/O (adapters)

Core tests use fakes that implement the port interface — fast, deterministic,
no infrastructure needed. Adapter tests use real temporary directories to
verify actual filesystem behavior. This follows the hexagonal testing
principle: test the core through ports, test adapters against real
infrastructure.

## Running it

```bash
# Build and test the core package (9 tests, ~40ms)
cd packages/core
npm install
npm run build-and-test

# Build and test the adapters package (13 tests, ~60ms)
cd packages/adapters
npm install
npm run build-and-test

# Verify the extension still type-checks and bundles
cd extensions/vscode
npm install
npx tsc --noEmit
npm run esbuild
```

## What comes next

See `TS_MIGRATION_PLAN.md` for the full migration plan. The next steps after
this PoC are:

1. Resolve remaining open questions (SSE, credential storage)
2. Wire the extension to call a core use case through
   `GoApiConfigurationStore` for one real operation (e.g., listing
   configurations in the sidebar), verifying identical behavior
3. Swap `GoApiConfigurationStore` for `FsConfigurationStore` for that
   operation, removing the Go API call
4. Expand to the next domain: deployment records
