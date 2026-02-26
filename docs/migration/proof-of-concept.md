# Proof of Concept: Configuration Domain

This document explains the proof-of-concept implementation in `packages/core/`
and `packages/adapters/`, and how it demonstrates the hexagonal architecture
migration plan described in `TS_MIGRATION_PLAN.md`.

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

1. Resolve remaining open questions (SSE, credential storage, migration
   approach)
2. Wire the extension to call the core use cases through the adapter for
   one real operation (replacing the equivalent Go API call)
3. Expand to the next domain: deployment records
