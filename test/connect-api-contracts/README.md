# Connect API Contract Tests

Contract tests that validate the HTTP requests Publisher sends **to Posit Connect** and how it parses Connect's responses. These ensure a future TypeScript ConnectClient produces identical behavior to the Go implementation.

This is fundamentally different from the [Publisher API contract tests](../api-contracts/) — those test Publisher's own API surface, while these test Publisher's role as a **client** of Connect's API.

## Architecture

```
Test code  →  Go harness (POST /call)  →  Mock Connect server (Node.js)
               { method: "CreateDeployment",    POST /__api__/v1/content
                 body: {...} }                   (canned Connect response)
```

Two servers are involved:

1. **Mock Connect server** — A Node.js HTTP server that simulates Connect's API endpoints with canned JSON responses and captures all incoming requests for assertion.
2. **Go harness** — A thin HTTP server with a single `POST /call` endpoint that dispatches to `APIClient` methods by name. Each request creates a fresh `ConnectClient` pointed at the mock, calls the target method, and returns the result plus captured requests as JSON.

The mock exposes control endpoints for tests:
- `GET /__test__/requests` — Read all captured requests
- `DELETE /__test__/requests` — Clear captured requests
- `POST /__test__/response-override` — Set a response override
- `DELETE /__test__/response-overrides` — Clear all response overrides

## What's tested

All 15 methods on the Go `APIClient` interface have corresponding test files, mock routes, and fixtures.

| Method | Connect Path |
|--------|-------------|
| `TestAuthentication` | `GET /__api__/v1/user` |
| `GetCurrentUser` | `GET /__api__/v1/user` |
| `ContentDetails` | `GET /__api__/v1/content/:id` |
| `CreateDeployment` | `POST /__api__/v1/content` |
| `UpdateDeployment` | `PATCH /__api__/v1/content/:id` |
| `GetEnvVars` | `GET /__api__/v1/content/:id/environment` |
| `SetEnvVars` | `PATCH /__api__/v1/content/:id/environment` |
| `UploadBundle` | `POST /__api__/v1/content/:id/bundles` |
| `DeployBundle` | `POST /__api__/v1/content/:id/deploy` |
| `WaitForTask` | `GET /__api__/v1/tasks/:id?first=N` |
| `ValidateDeployment` | `GET /content/:id/` |
| `GetIntegrations` | `GET /__api__/v1/oauth/integrations` |
| `GetSettings` | 7 endpoints (see below) |
| `LatestBundleID` | `GET /__api__/v1/content/:id` |
| `DownloadBundle` | `GET /__api__/v1/content/:id/bundles/:bid/download` |

`GetSettings` calls 7 endpoints in sequence: `/__api__/v1/user`, `/__api__/server_settings`, `/__api__/server_settings/applications`, `/__api__/server_settings/scheduler[/{appMode}]`, `/__api__/v1/server_settings/python`, `/__api__/v1/server_settings/r`, `/__api__/v1/server_settings/quarto`.

Each test validates both:
- **Request correctness** — method, path, `Authorization: Key <apiKey>` header
- **Response parsing** — Publisher correctly transforms Connect's DTO into its internal types

## Client implementations

| Client | Description |
|--------|-------------|
| `GoPublisherClient` | Calls the Go harness `POST /call`, which internally calls mock Connect |
| `TypeScriptDirectClient` | Stub for future TS ConnectClient (`call()` throws "Not implemented yet") |

Both implement a single `call(method, params?)` interface. The `connectUrl` and `apiKey` are injected at construction time, so tests only pass method-specific params.

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

1. Add a case to the `dispatch()` switch in the Go harness (`harness/main.go`)
2. Add a route handler in `src/mock-connect-server.ts` with a canned response fixture
3. Create a test file in `src/endpoints/` using `setupContractTest()`:

```ts
import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("NewMethod", () => {
  const { client } = setupContractTest();

  it("sends correct request", async () => {
    const result = await client.call("NewMethod", { contentId: "abc" });
    expect(result.capturedRequest!.method).toBe("GET");
  });
});
```

## Fixture files

- `src/fixtures/connect-responses/` — Canned JSON responses for Connect API endpoints
- `src/fixtures/workspace/` — Minimal project files (used by GetSettings for config)

## Future expansion

When the TS ConnectClient is built:
1. Implement the `call()` dispatcher in `ts-direct-client.ts` to route methods to the TS client
2. Both Go and TS paths validate against the same snapshots and request expectations
