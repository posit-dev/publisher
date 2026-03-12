# Deployment/ContentRecord TOML Migration Plan

## Goal

Migrate deployment (content record) TOML file handling from the Go API to TypeScript,
following the same pattern established by the configuration TOML migration. After this
migration, reading, creating, and patching deployment records will happen directly in
TypeScript. Publishing, canceling deployments, and fetching environment variables will
remain in Go.

## Background

Deployment records are TOML files stored at `.posit/publish/deployments/<name>.toml`.
They track where content has been deployed and contain metadata about the deployment
state, server info, and (for completed deployments) the full configuration snapshot,
file list, and package requirements.

The Go API currently provides seven endpoints for deployments. Four are pure TOML file
operations that we will migrate. Three require Go backend capabilities (server
communication, goroutine management) and will stay.

### Endpoints to migrate to TypeScript

| Endpoint                    | Purpose                          | TS Callers                                    |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| `GET /deployments`          | List all deployment records      | `state.ts`, `homeView.ts`, `newDeployment.ts` |
| `GET /deployments/{name}`   | Get a single deployment record   | `state.ts`                                    |
| `POST /deployments`         | Create a new deployment record   | `newDeployment.ts`                            |
| `PATCH /deployments/{name}` | Update config name or content ID | `homeView.ts`, `showAssociateGUID.ts`         |

### Endpoints staying in Go

| Endpoint                                    | Reason                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `POST /deployments/{name}` (publish)        | Full deployment pipeline: bundling, uploading, Connect API       |
| `POST /deployments/{name}/cancel/{localid}` | Interacts with Go's goroutine mutex and ActiveDeploymentRegistry |
| `GET /deployments/{name}/environment`       | Fetches env vars from Connect server API                         |

---

## Phase 1: Rename existing config-specific files

Rename files in `src/toml/` to clarify they are config-specific, making room for
deployment-specific counterparts.

| Current name    | New name              |
| --------------- | --------------------- |
| `loader.ts`     | `configLoader.ts`     |
| `writer.ts`     | `configWriter.ts`     |
| `discovery.ts`  | `configDiscovery.ts`  |
| `validate.ts`   | `configValidate.ts`   |
| `errors.ts`     | `configErrors.ts`     |
| `compliance.ts` | `configCompliance.ts` |

Update all imports accordingly. Tests follow the same rename pattern (e.g.
`loader.test.ts` -> `configLoader.test.ts`).

Shared utilities that will be used by both configs and deployments stay as-is:

- `convertKeys.ts` — already generic
- `schemas/` directory — will hold both schemas

---

## Phase 2: Extract shared utilities

Extract helpers from the config code that deployments will also need.

1. **`tomlHelpers.ts`** — shared TOML read/write utilities:
   - `readLeadingComments(content: string): string[]` (from configLoader.ts)
   - `stripEmpty(obj: Record<string, unknown>): void` (from configWriter.ts)
   - `isRecord(value: unknown): value is Record<string, unknown>` (from configWriter.ts)

2. **`urlHelpers.ts`** — Connect URL computation (new):

   ```typescript
   getDashboardUrl(serverUrl: string, contentId: string): string
   // => `${serverUrl}/connect/#/apps/${contentId}`

   getLogsUrl(serverUrl: string, contentId: string): string
   // => `${serverUrl}/connect/#/apps/${contentId}/logs`

   getDirectUrl(serverUrl: string, contentId: string): string
   // => `${serverUrl}/content/${contentId}/`
   ```

---

## Phase 3: Type reconciliation

Update TypeScript types to accurately represent what's in the TOML files.

### 3a. Add missing fields to existing types

In `src/api/types/contentRecords.ts`:

- Add `logsUrl?: string` to `OptionalPreDeploymentFields` (Go's preDeploymentDTO
  includes it; the loader's PopulateDefaults computes it)
- Add `requirements?: string[]` to `ContentRecord`
- Add `renv?: RenvLockfile` to `ContentRecord` (define a minimal type matching the
  JSON schema's renv structure)
- Note: `client_version` is written to TOML by Go but never exposed in the API or
  used by the frontend. The deployment writer will set it; the loader will ignore it
  (it passes through TOML parsing and schema validation but doesn't need a TS type
  field since it's never displayed).

### 3b. Copy the deployment record JSON schema

Copy `internal/schema/schemas/posit-publishing-record-schema-v3.json` to
`src/toml/schemas/posit-publishing-record-schema-v3.json`.

The schema has a `$ref` to the config schema. We need to either:

- Register the config schema with AJV so the `$ref` resolves, or
- Inline/bundle the referenced schema

Investigate which approach is simpler with AJV 2020.

---

## Phase 4: Deployment TOML loader

Create `src/toml/deploymentLoader.ts`:

1. Read file content from disk
2. Parse TOML (using smol-toml)
3. Validate against the deployment record JSON schema
4. Convert keys from snake_case to camelCase (reuse `convertKeys.ts`)
5. Apply defaults matching Go's `New()` + `PopulateDefaults()`:
   - Compute `logsUrl` from `serverUrl` + `id` if missing
   - Populate configuration defaults if embedded configuration is present
6. Compute `state`:
   - If load error -> `ContentRecordError`
   - If `deployedAt` is set -> `ContentRecordState.DEPLOYED`
   - Otherwise -> `ContentRecordState.NEW`
7. Attach location metadata: `deploymentName` (from filename), `deploymentPath`,
   `projectDir`
8. Return the appropriately typed result (`PreContentRecord`, `ContentRecord`, or
   `ContentRecordError`)

Create `src/toml/deploymentErrors.ts` with parallel error types:

- `ContentRecordLoadError` (parallel to `ConfigurationLoadError`)
- `createContentRecordError()` (parallel to `createConfigurationError()`)
- Reuse `createInvalidTOMLError()` and `createSchemaValidationError()` from shared
  or config errors (these are already generic enough)

Create `src/toml/deploymentValidate.ts`:

- Compile the deployment record schema with AJV 2020
- Export a `validateDeploymentRecord` function

---

## Phase 5: Deployment TOML writer

Create `src/toml/deploymentWriter.ts`:

### `createDeploymentRecord()`

For new deployments (replaces `POST /deployments`):

1. Accept: save name, server URL, server type, config name, cloud account name
   (optional), content ID (optional)
2. Build deployment object with:
   - `$schema` = deployment schema URL
   - `serverType`, `serverUrl` from credential
   - `configurationName` from selected config
   - `createdAt` = current ISO timestamp
   - `clientVersion` = extension version
   - `type` = "unknown" (matches Go's `New()`)
   - `connectCloud.accountName` if Connect Cloud
   - `id`, `dashboardUrl`, `directUrl`, `logsUrl` if content ID provided
3. Convert keys to snake_case
4. Strip empty values (reuse `stripEmpty`)
5. Write autogen header + TOML content
6. Return the typed result with location metadata

### `patchDeploymentRecord()`

For updating deployments (replaces `PATCH /deployments/{name}`):

1. Load existing deployment from disk (using the loader)
2. Apply updates:
   - If `configName` provided: update `configurationName`
   - If `id` (GUID) provided: update `id`, recompute `dashboardUrl`, `directUrl`,
     `logsUrl`
3. Convert to snake_case, strip empty values
4. Write back to disk with autogen header
5. Return the updated typed result

Note: Both functions check file existence (create requires not-exists, patch requires
exists) and validate the config file exists when a config name is provided, matching
Go's behavior.

---

## Phase 6: Deployment discovery

Create `src/toml/deploymentDiscovery.ts` (parallel to `configDiscovery.ts`):

- `getDeploymentDir(projectDir)` -> `.posit/publish/deployments`
- `getDeploymentPath(projectDir, name)` -> `.posit/publish/deployments/<name>.toml`
- `listDeploymentFiles(projectDir)` -> list `.toml` files in deployments dir
- `loadDeployment(name, projectDir, rootDir)` -> load single deployment
- `loadAllDeployments(projectDir, rootDir)` -> load all from one project
- `loadAllDeploymentsRecursive(rootDir)` -> walk and load all deployments

The recursive walk logic is very similar to `configDiscovery.ts`. Evaluate whether to
share the walk infrastructure (e.g., a generic `walkPositDirs()` that takes a callback)
or keep it duplicated. Lean toward duplication if sharing makes the code harder to
follow.

---

## Phase 7: Update `src/toml/index.ts` exports

Add the new deployment public API alongside the existing config exports:

```typescript
// Configs
export { writeConfigToFile } from "./configWriter";
export { ConfigurationLoadError } from "./configErrors";
export {
  loadConfiguration,
  loadAllConfigurations,
  loadAllConfigurationsRecursive,
} from "./configDiscovery";

// Deployments
export {
  createDeploymentRecord,
  patchDeploymentRecord,
} from "./deploymentWriter";
export { ContentRecordLoadError } from "./deploymentErrors";
export {
  loadDeployment,
  loadAllDeployments,
  loadAllDeploymentsRecursive,
} from "./deploymentDiscovery";
```

---

## Phase 8: Update callers

Replace Go API calls with direct TypeScript function calls.

### `state.ts`

- `api.contentRecords.getAll(".", { recursive: true })`
  -> `loadAllDeploymentsRecursive(rootDir)`
- `api.contentRecords.get(name, dir)`
  -> `loadDeployment(name, dir, rootDir)`

### `homeView.ts`

- `api.contentRecords.patch(name, dir, { configName })`
  -> `patchDeploymentRecord(name, dir, rootDir, { configName })`
- `api.contentRecords.getAll(dir, { recursive: false })`
  -> `loadAllDeployments(dir, rootDir)`

### `newDeployment.ts`

- `api.contentRecords.getAll(dir, { recursive: true })`
  -> `loadAllDeploymentsRecursive(rootDir)` (or scoped variant)
- `api.contentRecords.createNew(dir, credentialName, configName, saveName)`
  -> `createDeploymentRecord(saveName, dir, rootDir, { serverUrl: cred.url, serverType: cred.serverType, configName, cloudAccountName: cred.accountName, contentId })`

### `showAssociateGUID.ts`

- `api.contentRecords.patch(name, dir, { guid })`
  -> `patchDeploymentRecord(name, dir, rootDir, { id: guid })`

### Keep unchanged (Go API calls)

- `homeView.ts` — `api.contentRecords.publish(...)` stays
- `homeView.ts` — `api.contentRecords.getEnv(...)` stays
- `deployProgress.ts` — `api.contentRecords.cancelDeployment(...)` stays

---

## Phase 9: Remove migrated Go APIs

1. Remove Go handlers:
   - `GetDeploymentsHandlerFunc` (get_deployments.go)
   - `GetDeploymentHandlerFunc` (get_deployment.go)
   - `PostDeploymentsHandlerFunc` (post_deployments.go)
   - `PatchDeploymentHandlerFunc` (patch_deployment.go)

2. Remove corresponding route registrations in `api_service.go`

3. Remove or simplify `deployment_dto.go`:
   - `preDeploymentDTO` and its construction logic — no longer needed
   - `deploymentAsDTO` may still be needed by the remaining publish/cancel handlers
     (they return the updated deployment as a DTO after the operation). Investigate
     whether those callers can be simplified.

4. Remove `PostDeploymentsRequestBody` and `PatchDeploymentRequestBody` structs

5. Clean up `ContentRecords.ts` API resource class:
   - Remove `getAll()`, `get()`, `createNew()`, `patch()` methods
   - Keep `publish()`, `getEnv()`, `cancelDeployment()` methods

---

## Phase 10: Manual testing plan

### Deployment record reading

- [ ] Open a workspace with no `.posit/publish/deployments/` directory — extension loads, no deployments shown
- [ ] Open a workspace with existing deployment TOML files — all listed correctly in the sidebar
- [ ] Open a multi-project workspace — recursive discovery finds deployments in subdirectories
- [ ] Place an invalid TOML file in the deployments directory — error displayed, other deployments still load
- [ ] Place a TOML file that fails schema validation — error displayed correctly

### Creating new deployments

- [ ] Create a new deployment via the wizard (Connect server) — TOML file created with correct fields
- [ ] Create a new deployment for Connect Cloud — `connect_cloud` section present in TOML
- [ ] Attempt to create a deployment with a name that already exists — conflict error
- [ ] Create a deployment with a content ID — URLs computed correctly in TOML

### Patching deployments

- [ ] Associate a GUID with an existing deployment — TOML updated with ID and computed URLs
- [ ] Change the associated configuration — TOML updated with new config name
- [ ] Attempt to patch with a config name that doesn't exist — error

### Operations that stay in Go

- [ ] Full publish flow — deploy to Connect, verify deployment record updated by Go
- [ ] Cancel an in-progress deployment — verify dismissed_at written
- [ ] View environment variables — verify fetched from Connect server

### Edge cases

- [ ] Deployment TOML written by Go (during publish) is readable by TypeScript loader
- [ ] Deployment TOML written by TypeScript (create/patch) is readable by Go (during publish)
- [ ] `logsUrl` computed by PopulateDefaults when missing from older TOML files

---

## Key design decisions

1. **Partial migration**: Only TOML file operations move to TypeScript. Server-communicating
   endpoints stay in Go. Both Go and TypeScript read/write the same TOML file format.

2. **State is computed, not stored**: The `state` field (new/deployed/error) is derived
   from the parsed data, not written to TOML. This matches Go's DTO behavior.

3. **No account lookup needed**: The `createNew()` call site already has the full
   `Credential` object in scope. We pass server URL, server type, and cloud account
   name directly instead of looking up by credential name.

4. **`configurationPath` skipped**: The Go DTO includes it but TypeScript never uses
   it on deployment records.

5. **`client_version` preserved on write**: Written to TOML for provenance but not
   exposed as a typed field in the UI-facing types.

6. **Duplicate vs shared code**: Prefer clarity over DRY. Deployment-specific files
   (loader, writer, discovery, errors, validate) are separate from config-specific
   files. Shared utilities (key conversion, TOML helpers, URL helpers) are extracted
   when genuinely generic.
