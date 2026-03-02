# TS_MIGRATION_PLAN.md

This document describes a plan to migrate the Posit Publisher extension from
using its current Go REST API `/configurations/${encodedName}` backend to an
in-process TypeScript core package for loading a configuration.

## Current State

The `get` method in extensions/vscode/src/api/resources/Configurations.ts
returns a `Promise` wrapping an `AxiosResponse` wrapping the domain types
`Configuration | ConfigurationErrror` which are defined in
extensions/vscode/src/api/types/configurations.ts.

The callsite in extensions/vscode/src/state.ts uses the `data` field of the
response.

Errors are handled by a `catch` block that checks for Axios errors and handle
them.

## Desired End State

The callsite in extensions/vscode/src/state.ts calls a pure-TypeScript function
with no dependencies on vscode or axios. The `core` module defines an interface,
`ConfigurationStore`, with a `get` function that matches the api resource
function, but without the `AxiosResponse` wrapper. The `adapters` module defines
`FSConfigurationStore`, an implementation of the interface that uses the
`smol-toml` library to load and parse configurations from the file system. The
callsite in state.ts handles potential errors from the TypeScript function.

## Package Structure

This is a suggested package structure.

Key details:

- the existing `api` types are maintained in-place to minimize changes during
  the migration
- `core` defines pure domain types, interfaces, and functions, with no
  dependencies
- `adapters` defines an implementation with dependencies on external packages
  and the file system

```
extensions/vscode/
├── adapters/
│   └── fs-configuration-store.ts                 # ConfigurationStore → TOML files
├── core/
│   ├── ports.ts                                  # ConfigurationStore interface
│   ├── errors.ts                                 # Domain errors and error helpers
│   └── [other file names].ts                     # Pure domain functions (ported from Go)
├── src/
│   ├── state.ts                                  # Existing callsite uses new ConfigurationStore impl
```

## Approach

Implement the TypeScript replacement as outlined, but stop and ask questions if
anything doesn't make sense or requires deviating from the plan. Add tests for
new code. Do not modify any go code. Make sure the extension continues to build
and tests pass using the recipes in `extensions/vscode/justfile`. If you find
yourself having to make a lot of changes to a lot of files, stop and ask for
guidance. This should be a minimally invasive refactor.
