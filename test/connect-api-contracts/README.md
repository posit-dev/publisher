# Connect API Contract Tests

Contract tests that validate the HTTP requests Publisher sends **to Posit Connect** and how it parses Connect's responses. Tests run against a Node.js mock Connect server and exercise the shared `@posit-dev/connect-api` client (the same client the extension uses in production).

## Architecture

```
Test code  →  TypeScriptDirectClient  →  @posit-dev/connect-api  →  Mock Connect server (Node.js)
                                                                      POST /__api__/v1/content
                                                                      (canned Connect response)
```

One server is involved:

- **Mock Connect server** — A Node.js HTTP server (`src/mock-connect-server.ts`) that simulates Connect's API endpoints with canned JSON responses and captures all incoming requests for assertion.

Tests construct a `TypeScriptDirectClient` pointed at the mock. The client dispatches `call(method, params)` to the corresponding method on the shared `@posit-dev/connect-api` client, which issues real HTTP requests to the mock. Captured requests and responses flow back to the test for assertion.

The mock exposes control endpoints for tests:

- `GET /__test__/requests` — Read all captured requests
- `DELETE /__test__/requests` — Clear captured requests
- `POST /__test__/response-override` — Set a response override
- `DELETE /__test__/response-overrides` — Clear all response overrides

## What's tested

All 15 entries in the `Method` constant have corresponding test files, mock routes, and fixtures.

| Method               | Connect Path                                        |
| -------------------- | --------------------------------------------------- |
| `TestAuthentication` | `GET /__api__/v1/user`                              |
| `GetCurrentUser`     | `GET /__api__/v1/user`                              |
| `ContentDetails`     | `GET /__api__/v1/content/:id`                       |
| `CreateDeployment`   | `POST /__api__/v1/content`                          |
| `UpdateDeployment`   | `PATCH /__api__/v1/content/:id`                     |
| `GetEnvVars`         | `GET /__api__/v1/content/:id/environment`           |
| `SetEnvVars`         | `PATCH /__api__/v1/content/:id/environment`         |
| `UploadBundle`       | `POST /__api__/v1/content/:id/bundles`              |
| `DeployBundle`       | `POST /__api__/v1/content/:id/deploy`               |
| `WaitForTask`        | `GET /__api__/v1/tasks/:id?first=N`                 |
| `ValidateDeployment` | `GET /content/:id/`                                 |
| `GetIntegrations`    | `GET /__api__/v1/oauth/integrations`                |
| `GetSettings`        | 7 endpoints (see below)                             |
| `LatestBundleID`     | `GET /__api__/v1/content/:id`                       |
| `DownloadBundle`     | `GET /__api__/v1/content/:id/bundles/:bid/download` |

`GetSettings` calls 7 endpoints in sequence: `/__api__/v1/user`, `/__api__/server_settings`, `/__api__/server_settings/applications`, `/__api__/server_settings/scheduler[/{appMode}]`, `/__api__/v1/server_settings/python`, `/__api__/v1/server_settings/r`, `/__api__/v1/server_settings/quarto`.

Each test validates both:

- **Request correctness** — method, path, `Authorization: Key <apiKey>` header
- **Response parsing** — Publisher correctly transforms Connect's DTO into its internal types

## Client

`TypeScriptDirectClient` (`src/clients/ts-direct-client.ts`) implements the `ConnectContractClient` interface. It wraps the shared `@posit-dev/connect-api` package and dispatches `call(method, params?)` to the corresponding SDK method. The `connectUrl` and `apiKey` are injected at construction time, so tests only pass method-specific params. Method names are typed via the `Method` constant and `MethodName` type exported from `src/client.ts` (e.g. `Method.CreateDeployment` instead of a raw string).

## Running

```bash
# Run Connect contract tests
just test-connect-contracts

# Or directly
cd test/connect-api-contracts && npm test

# Update snapshots (currently only one inline snapshot in authentication.test.ts)
cd test/connect-api-contracts && npm run test:update

# Validate fixtures against the Connect Swagger spec
just validate-fixtures
```

## Swagger spec validation

Fixture files are validated against the [Connect public Swagger spec](https://docs.posit.co/connect/api/swagger.json) to ensure they match the real API schemas. This catches drift between our test fixtures and the actual Connect API.

The validation suite:

- Fetches the Swagger spec (cached locally for 24 hours in `.cache/`)
- Resolves `$ref` pointers and transforms `x-nullable` to JSON Schema nullable types
- Validates each fixture against its corresponding endpoint's response schema using AJV
- Warns about extra fields in fixtures that aren't in the spec (non-failing)
- Skips fixtures for undocumented internal endpoints (e.g. `server_settings`, `server_settings/applications`)

Fixture-to-endpoint mappings are defined in `src/validation/fixture-map.ts`. When adding a new fixture, add a corresponding entry there.

## Adding tests

1. Add a new entry to the `Method` constant in `src/client.ts` and dispatch it inside the `dispatch()` switch in `TypeScriptDirectClient` (`src/clients/ts-direct-client.ts`)
2. Add a route handler in `src/mock-connect-server.ts` with a canned response fixture
3. Create a test file in `src/endpoints/` using `setupContractTest()`:

```ts
import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";
import { Method } from "../client";

describe("NewMethod", () => {
  const { client } = setupContractTest();

  it("sends correct request", async () => {
    const result = await client.call(Method.NewMethod, { contentId: "abc" });
    expect(result.capturedRequest!.method).toBe("GET");
  });
});
```

4. Add a fixture mapping in `src/validation/fixture-map.ts` for Swagger validation

## Project structure

- `src/client.ts` — `Method` constants, `MethodName` type, and `ConnectContractClient` interface
- `src/clients/ts-direct-client.ts` — `TypeScriptDirectClient` implementation wrapping `@posit-dev/connect-api`
- `src/mock-connect-server.ts` — `MockConnectServer` class with route-based dispatch and test control endpoints
- `src/helpers.ts` — `setupContractTest()` helper for test setup/teardown
- `src/endpoints/` — One test file per `Method` entry
- `src/fixtures/connect-responses/` — Canned JSON responses for Connect API endpoints
- `src/fixtures/workspace/` — Minimal project files (used by GetSettings for config)
- `src/validation/` — Swagger spec validation for fixtures
