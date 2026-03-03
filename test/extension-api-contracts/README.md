# Extension API Contract Tests

Contract tests that validate how the **extension's HTTP client** constructs requests to Publisher's API and parses responses. While the [Publisher API contract tests](../api-contracts/) validate the server's behavior with a real Go binary, these tests validate the **client side** — ensuring the Axios-based extension correctly builds URLs, query params, headers, and request bodies.

This is the complement of the [Publisher API contract tests](../api-contracts/), not a replacement. Together they form a complete contract: one side verifies the server, the other verifies the client.

## Architecture

```
Test code  →  Axios client (mirrors extension)  →  Mock Publisher server (Node.js)
               GET /configurations?dir=...           canned JSON response
               (same paths, params, body shapes)     (matches Go backend shapes)
```

A single mock server is involved:

1. **Mock Publisher server** — A Node.js HTTP server that returns canned JSON responses matching the shapes the Go backend produces, and captures all incoming requests for assertion.

The mock exposes control endpoints for tests:
- `GET /__test__/requests` — Read all captured requests
- `DELETE /__test__/requests` — Clear captured requests

Unlike the other contract test suites, no Go binary or temp workspace is needed — the mock server handles everything.

## What's tested

The Axios client mirrors the exact HTTP calls made by the extension's resource classes (`extensions/vscode/src/api/resources/`):

| Client Method | Extension Class | HTTP Request |
|--------------|----------------|--------------|
| `getConfigurations` | `Configurations.getAll` | `GET /configurations?dir=...` |
| `getConfiguration` | `Configurations.get` | `GET /configurations/:name?dir=...` |
| `createOrUpdateConfiguration` | `Configurations.createOrUpdate` | `PUT /configurations/:name?dir=...` |
| `deleteConfiguration` | `Configurations.delete` | `DELETE /configurations/:name?dir=...` |
| `listCredentials` | `Credentials.list` | `GET /credentials` |
| `createCredential` | `Credentials.connectCreate` | `POST /credentials` |
| `getCredential` | `Credentials.get` | `GET /credentials/:guid` |
| `deleteCredential` | `Credentials.delete` | `DELETE /credentials/:guid` |
| `resetCredentials` | `Credentials.reset` | `DELETE /credentials` |
| `testCredentials` | `Credentials.test` | `POST /test-credentials` |
| `getDeployments` | `ContentRecords.getAll` | `GET /deployments?dir=...` |
| `getDeployment` | `ContentRecords.get` | `GET /deployments/:id?dir=...` |
| `createDeployment` | `ContentRecords.createNew` | `POST /deployments?dir=...` |
| `deleteDeployment` | `ContentRecords.delete` | `DELETE /deployments/:name?dir=...` |
| `patchDeployment` | `ContentRecords.patch` | `PATCH /deployments/:name?dir=...` |

Each test validates:
- **Request correctness** — method, path, query params, headers, body
- **Response parsing** — client returns correctly shaped data with correct status
- **Snapshot** — response shape stability

## URL path note

The extension resource classes have an inconsistency: some use leading `/` (e.g., `"/configurations"`) and others don't (e.g., `"credentials"`). With Axios, a leading `/` resolves relative to the origin, bypassing any path component in `baseURL`. The mock server registers routes without any `/api` prefix to match the actual resolved paths.

## Client implementations

| Client | Description |
|--------|-------------|
| `AxiosExtensionClient` | Axios-based client mirroring the real extension's HTTP calls |
| `FetchReferenceClient` | Stub for future Positron/fetch-based client (all methods throw) |

Set `API_BACKEND=fetch` to run against the fetch client once implemented.

## Running

```bash
# Install dependencies
cd test/extension-api-contracts && npm install

# Run tests
just test-extension-contracts

# Or directly
cd test/extension-api-contracts && npx vitest run

# Update snapshots
cd test/extension-api-contracts && npx vitest run --update

# Watch mode
cd test/extension-api-contracts && npx vitest
```

## Adding tests

1. Add a method to the `ExtensionContractClient` interface in `src/client.ts`
2. Implement it in both `src/clients/axios-extension-client.ts` and `src/clients/fetch-reference-client.ts`
3. Add a route handler in `src/mock-publisher-server.ts` with a canned response fixture
4. Create or update a test file in `src/endpoints/`
5. Use `getClient()` from `src/helpers.ts` to get the appropriate client

## Fixture files

- `src/fixtures/publisher-responses/` — Canned JSON responses matching the shapes the Go backend returns

## Related test suites

- [Publisher API contract tests](../api-contracts/) — Tests Publisher's server side (real Go binary + raw fetch client)
- [Connect API contract tests](../connect-api-contracts/) — Tests Publisher as a client of Connect (Go binary + mock Connect server)
