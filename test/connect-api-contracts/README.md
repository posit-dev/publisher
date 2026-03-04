# Connect API Contract Tests

Contract tests that validate the HTTP requests Publisher sends **to Posit Connect** and how it parses Connect's responses. These ensure a future TypeScript ConnectClient produces identical behavior to the Go implementation.

This is fundamentally different from the [Publisher API contract tests](../api-contracts/) — those test Publisher's own API surface, while these test Publisher's role as a **client** of Connect's API.

## Architecture

```
Test code  →  Go harness             →  Mock Connect server (Node.js)
               POST /test-authentication    GET /__api__/v1/user
               POST /create-deployment      POST /__api__/v1/content
               (1:1 per APIClient method)   (canned Connect response)
```

Two servers are involved:

1. **Mock Connect server** — A Node.js HTTP server that simulates Connect's API endpoints with canned JSON responses and captures all incoming requests for assertion.
2. **Go harness** — A thin HTTP server that wraps each `APIClient` method as its own endpoint. Each request creates a fresh `ConnectClient` pointed at the mock, calls the target method, and returns the result as JSON.

The mock exposes control endpoints for tests:
- `GET /__test__/requests` — Read all captured requests
- `DELETE /__test__/requests` — Clear captured requests
- `POST /__test__/response-override` — Set a response override
- `DELETE /__test__/response-overrides` — Clear all response overrides

## What's tested

All 15 methods on the Go `APIClient` interface have corresponding test files, mock routes, and fixtures.

| Endpoint | Connect Path | Harness Endpoint |
|----------|-------------|-----------------|
| `TestAuthentication` | `GET /__api__/v1/user` | `POST /test-authentication` |
| `GetCurrentUser` | `GET /__api__/v1/user` | `POST /get-current-user` |
| `ContentDetails` | `GET /__api__/v1/content/:id` | `POST /content-details` |
| `CreateDeployment` | `POST /__api__/v1/content` | `POST /create-deployment` |
| `UpdateDeployment` | `PATCH /__api__/v1/content/:id` | `POST /update-deployment` |
| `GetEnvVars` | `GET /__api__/v1/content/:id/environment` | `POST /get-env-vars` |
| `SetEnvVars` | `PATCH /__api__/v1/content/:id/environment` | `POST /set-env-vars` |
| `UploadBundle` | `POST /__api__/v1/content/:id/bundles` | `POST /upload-bundle` |
| `DeployBundle` | `POST /__api__/v1/content/:id/deploy` | `POST /deploy-bundle` |
| `WaitForTask` | `GET /__api__/v1/tasks/:id?first=N` | `POST /wait-for-task` |
| `ValidateDeployment` | `GET /content/:id/` | `POST /validate-deployment` |
| `GetIntegrations` | `GET /__api__/v1/oauth/integrations` | `POST /get-integrations` |
| `GetSettings` | 7 endpoints (see below) | `POST /get-settings` |
| `LatestBundleID` | `GET /__api__/v1/content/:id` | `POST /latest-bundle-id` |
| `DownloadBundle` | `GET /__api__/v1/content/:id/bundles/:bid/download` | `POST /download-bundle` |

`GetSettings` calls 7 endpoints in sequence: `/__api__/v1/user`, `/__api__/server_settings`, `/__api__/server_settings/applications`, `/__api__/server_settings/scheduler[/{appMode}]`, `/__api__/v1/server_settings/python`, `/__api__/v1/server_settings/r`, `/__api__/v1/server_settings/quarto`.

Each test validates both:
- **Request correctness** — method, path, `Authorization: Key <apiKey>` header
- **Response parsing** — Publisher correctly transforms Connect's DTO into its internal types

## Client implementations

| Client | Description |
|--------|-------------|
| `GoPublisherClient` | Calls the Go harness, which internally calls mock Connect |
| `TypeScriptDirectClient` | Stub for future TS ConnectClient (all methods throw) |

Set `API_BACKEND=typescript` to run against the TS client once implemented.

## Running

```bash
# Run Connect contract tests (harness is built automatically)
just test-connect-contracts

# Or directly
cd test/connect-api-contracts && npx vitest run

# Build the harness binary manually
just build-connect-harness

# Update snapshots
cd test/connect-api-contracts && npx vitest run --update
```

## Adding tests

1. Add a method to the `ConnectContractClient` interface in `src/client.ts`
2. Implement it in both `src/clients/go-publisher-client.ts` and `src/clients/ts-direct-client.ts`
3. Add a handler in the Go harness (`harness/main.go`)
4. Add a route handler in `src/mock-connect-server.ts` with a canned response fixture
5. Create a test file in `src/endpoints/`
6. Use `getClient()` from `src/helpers.ts` to get the appropriate client

## Fixture files

- `src/fixtures/connect-responses/` — Canned JSON responses for Connect API endpoints
- `src/fixtures/workspace/` — Minimal project files (used by GetSettings for config)

## Future expansion

When the TS ConnectClient is built:
1. Implement `ts-direct-client.ts` to call the TS client directly against the mock
2. Both Go and TS paths validate against the same snapshots and request expectations
