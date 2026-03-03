# Connect API Contract Tests

Contract tests that validate the HTTP requests Publisher sends **to Posit Connect** and how it parses Connect's responses. These ensure a future TypeScript ConnectClient produces identical behavior to the Go implementation.

This is fundamentally different from the [Publisher API contract tests](../api-contracts/) — those test Publisher's own API surface, while these test Publisher's role as a **client** of Connect's API.

## Architecture

```
Test code  →  Publisher binary (Go)  →  Mock Connect server (Node.js)
               POST /api/test-credentials     GET /__api__/v1/user
               (Publisher's own API)           (canned Connect response)
```

Two servers are involved:

1. **Mock Connect server** — A Node.js HTTP server that simulates Connect's API endpoints with canned JSON responses and captures all incoming requests for assertion.
2. **Publisher binary** — The system under test, which makes outbound HTTP calls to the mock.

The mock exposes control endpoints for tests:
- `GET /__test__/requests` — Read all captured requests
- `DELETE /__test__/requests` — Clear captured requests

## What's tested

All 15 methods on the Go `APIClient` interface have corresponding test files, mock routes, and fixtures. Only `TestAuthentication` is currently active (triggerable via the Go path); all others are `describe.skip` until the TS ConnectClient is implemented.

| Endpoint | Connect Path | Status |
|----------|-------------|--------|
| `TestAuthentication` | `GET /__api__/v1/user` | **Active** (8 tests) |
| `GetCurrentUser` | `GET /__api__/v1/user` | Skipped |
| `ContentDetails` | `GET /__api__/v1/content/:id` | Skipped |
| `CreateDeployment` | `POST /__api__/v1/content` | Skipped |
| `UpdateDeployment` | `PATCH /__api__/v1/content/:id` | Skipped |
| `GetEnvVars` | `GET /__api__/v1/content/:id/environment` | Skipped |
| `SetEnvVars` | `PATCH /__api__/v1/content/:id/environment` | Skipped |
| `UploadBundle` | `POST /__api__/v1/content/:id/bundles` | Skipped |
| `DeployBundle` | `POST /__api__/v1/content/:id/deploy` | Skipped |
| `WaitForTask` | `GET /__api__/v1/tasks/:id?first=N` | Skipped |
| `ValidateDeployment` | `GET /content/:id/` | Skipped |
| `GetIntegrations` | `GET /__api__/v1/oauth/integrations` | Skipped |
| `GetSettings` | 7 endpoints (see below) | Skipped |
| `LatestBundleID` | `GET /__api__/v1/content/:id` | Skipped |
| `DownloadBundle` | `GET /__api__/v1/content/:id/bundles/:bid/download` | Skipped |

`GetSettings` calls 7 endpoints in sequence: `/__api__/v1/user`, `/__api__/server_settings`, `/__api__/server_settings/applications`, `/__api__/server_settings/scheduler[/{appMode}]`, `/__api__/v1/server_settings/python`, `/__api__/v1/server_settings/r`, `/__api__/v1/server_settings/quarto`.

Each test validates both:
- **Request correctness** — method, path, `Authorization: Key <apiKey>` header
- **Response parsing** — Publisher correctly transforms Connect's DTO into its internal types

## Client implementations

| Client | Description |
|--------|-------------|
| `GoPublisherClient` | Calls Publisher's HTTP API, which internally calls mock Connect |
| `TypeScriptDirectClient` | Stub for future TS ConnectClient (all methods throw) |

Set `API_BACKEND=typescript` to run against the TS client once implemented.

## Running

```bash
# Build the Go binary first
just build

# Run Connect contract tests
just test-connect-contracts

# Or directly
cd test/connect-api-contracts && npx vitest run

# Update snapshots
cd test/connect-api-contracts && npx vitest run --update
```

## Adding tests

1. Add a method to the `ConnectContractClient` interface in `src/client.ts`
2. Implement it in both `src/clients/go-publisher-client.ts` and `src/clients/ts-direct-client.ts`
3. Add a route handler in `src/mock-connect-server.ts` with a canned response fixture
4. Create a test file in `src/endpoints/`
5. Use `getClient()` from `src/helpers.ts` to get the appropriate client

## Fixture files

- `src/fixtures/connect-responses/` — Canned JSON responses for Connect API endpoints
- `src/fixtures/workspace/` — Minimal project for Publisher startup (copied from `test/api-contracts/`)

## Future expansion

When the TS ConnectClient is built:
1. Implement `ts-direct-client.ts` to call the TS client directly against the mock
2. Un-skip all test files — fixtures, mock routes, and test assertions are already in place
3. Both Go and TS paths validate against the same snapshots and request expectations
