# Publisher API Contract Tests

Contract tests that validate the HTTP API surface of the Publisher backend. These ensure that the Go backend and a future TypeScript backend produce identical responses for the same API calls.

## Architecture

```
Test code  →  Publisher binary (Go)
               GET/POST/PUT/PATCH/DELETE /api/*
```

A single server is involved: the Publisher binary, which is spawned as a subprocess. Tests call Publisher's own REST API and assert on response status codes and body shapes.

## What's tested

- **Configurations** — CRUD operations on `.posit/publish/*.toml` files
- **Credentials** — Create, list, delete server credentials
- **Deployments** — CRUD operations on `.posit/publish/deployments/*.toml` files

## Client implementations

| Client | Description |
|--------|-------------|
| `GoHttpClient` | Calls Publisher's HTTP API (the current Go binary) |
| `TypeScriptDirectClient` | Stub for future TS backend (all methods throw) |

Set `API_BACKEND=typescript` to run against the TS client once implemented.

## Running

```bash
# Build the Go binary first
just build

# Run contract tests
just test-contracts

# Or directly
cd test/api-contracts && npx vitest run

# Update snapshots
cd test/api-contracts && npx vitest run --update
```

## Adding tests

1. Add a method to the `BackendClient` interface in `src/client.ts`
2. Implement it in both `src/clients/go-http-client.ts` and `src/clients/typescript-direct-client.ts`
3. Create a test file in `src/endpoints/`
4. Use `getClient()` from `src/helpers.ts` to get the appropriate client

## Fixture workspace

`src/fixtures/workspace/` contains a minimal project that Publisher needs to start. The workspace is copied to a temp directory for each test run.
