# TypeScript Core Migration Plan

This document records the plan and decisions for migrating the Posit Publisher
extension from its current Go REST API backend to an in-process TypeScript core
package using hexagonal architecture (ports and adapters).

Reference: https://github.com/christierney/hexatype demonstrates this pattern
at small scale. This plan adapts the same principles to the Posit Publisher
codebase.

---

## Key Decisions

- The domain logic will run **in-process** inside the extension — no separate
  server.
- The core package will be **separate from the extension** so it can be tested
  independently and potentially reused by other driving adapters (e.g. a CLI).
- The repository will use **npm workspaces** to enforce a clean boundary between
  the core package and the extension.
- The migration will be **incremental** — the extension must be able to call
  either the Go API or the local TypeScript implementation for any given
  operation during the transition.
- The codebase should use **modern idiomatic TypeScript** with **minimal
  external dependencies**, preferring Node.js built-in APIs where sufficient.

---

## Phase 1: Inventory

### 1.1 Go API Endpoint Surface

The Go backend exposes **46 REST endpoints** via Gorilla Mux, plus one SSE
stream. All routes are prefixed with `/api`. The extension communicates via
axios HTTP client, and all calls are centralized in the `src/api/` module.

#### Accounts

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/accounts | `GetAccountsHandlerFunc` | Read-only. List server accounts. |
| GET | /api/accounts/{name} | `GetAccountHandlerFunc` | Read-only. Single account by name. |
| POST | /api/accounts/{name}/verify | `PostAccountVerifyHandlerFunc` | Side-effect: tests auth against remote Connect server. |
| GET | /api/accounts/{name}/integrations | `GetIntegrationsHandlerFunc` | Read-only. Calls remote Connect server. |
| GET | /api/accounts/{name}/server-settings | `GetServerSettingsHandlerFunc` | Read-only. Calls remote Connect server. |

#### Credentials

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/credentials | `GetCredentialsHandlerFunc` | Read-only. Lists stored credentials. |
| GET | /api/credentials/{guid} | `GetCredentialHandlerFunc` | Read-only. Single credential. |
| POST | /api/credentials | `PostCredentialFuncHandler` | Mutating. Creates credential in keyring/file. |
| DELETE | /api/credentials/{guid} | `DeleteCredentialHandlerFunc` | Mutating. Removes credential. |
| DELETE | /api/credentials | `ResetCredentialsHandlerFunc` | Mutating. Resets all credentials (with backup). |
| POST | /api/test-credentials | `PostTestCredentialsHandlerFunc` | Side-effect: tests creds against remote server. |

#### Connect Authentication

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | /api/connect/token | `PostConnectTokenHandlerFunc` | Side-effect: generates token via remote Connect. |
| POST | /api/connect/token/user | `PostConnectTokenUserHandlerFunc` | Side-effect: checks token claim status. |

#### Connect Cloud Authentication

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | /api/connect-cloud/device-auth | `PostConnectCloudDeviceAuthHandlerFunc` | Side-effect: initiates OAuth device flow. |
| POST | /api/connect-cloud/oauth/token | `PostConnectCloudOAuthTokenHandlerFunc` | Side-effect: exchanges device code for tokens. |
| GET | /api/connect-cloud/accounts | `GetConnectCloudAccountsFunc` | Side-effect: fetches user's cloud accounts. |

#### Configurations

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/configurations | `GetConfigurationsHandlerFunc` | Read-only. Lists configs from `.posit/publish/`. |
| GET | /api/configurations/{name} | `GetConfigurationHandlerFunc` | Read-only. Single config. |
| PUT | /api/configurations/{name} | `PutConfigurationHandlerFunc` | Mutating. Creates/updates TOML config file. |
| DELETE | /api/configurations/{name} | `DeleteConfigurationHandlerFunc` | Mutating. Deletes config file. |
| GET | /api/configurations/{name}/files | `GetConfigFilesHandlerFunc` | Read-only. Lists files included in config. |
| POST | /api/configurations/{name}/files | `PostConfigFilesHandlerFunc` | Mutating. Updates file list in config. |
| GET | /api/configurations/{name}/secrets | `GetConfigSecretsHandlerFunc` | Read-only. Lists secret names in config. |
| POST | /api/configurations/{name}/secrets | `PostConfigSecretsHandlerFunc` | Mutating. Updates secrets list in config. |
| GET | /api/configurations/{name}/packages/python | `NewGetConfigPythonPackagesHandler` | Read-only. Reads Python packages from config. |
| GET | /api/configurations/{name}/packages/r | `NewGetConfigRPackagesHandler` | Read-only. Reads R packages from config. |
| GET | /api/configurations/{name}/integration-requests | `GetIntegrationRequestsFuncHandler` | Read-only. |
| POST | /api/configurations/{name}/integration-requests | `PostIntegrationRequestFuncHandler` | Mutating. |
| DELETE | /api/configurations/{name}/integration-requests | `DeleteIntegrationRequestFuncHandler` | Mutating. |

#### Deployments

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/deployments | `GetDeploymentsHandlerFunc` | Read-only. Lists deployment records. |
| GET | /api/deployments/{name} | `GetDeploymentHandlerFunc` | Read-only. Single deployment record. |
| POST | /api/deployments | `PostDeploymentsHandlerFunc` | Mutating. Creates deployment record. |
| PATCH | /api/deployments/{name} | `PatchDeploymentHandlerFunc` | Mutating. Updates deployment record. |
| DELETE | /api/deployments/{name} | `DeleteDeploymentHandlerFunc` | Mutating. Deletes deployment record. |
| POST | /api/deployments/{name} | `PostDeploymentHandlerFunc` | Side-effect: initiates async publish to Connect. **Most complex endpoint.** |
| POST | /api/deployments/{name}/cancel/{localid} | `PostDeploymentCancelHandlerFunc` | Side-effect: cancels active publish. |
| GET | /api/deployments/{name}/environment | `GetDeploymentEnvironmentHandlerFunc` | Side-effect: reads env vars from remote Connect. |

#### File System / Inspection

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/files | `GetFileHandlerFunc` | Read-only. File/directory info. |
| POST | /api/entrypoints | `GetEntrypointsHandlerFunc` | Read-only. Detects entrypoint files. |
| POST | /api/inspect | `PostInspectHandlerFunc` | Read-only. Detects project type and suggests configs. |

#### Interpreters & Packages

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/interpreters | `GetActiveInterpretersHandlerFunc` | Read-only. Detects Python/R interpreters. |
| POST | /api/packages/python/scan | `NewPostPackagesPythonScanHandler` | Side-effect: scans and writes requirements.txt. |
| POST | /api/packages/r/scan | `NewPostPackagesRScanHandler` | Side-effect: scans and writes renv.lock. |

#### Other

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | /api/events | SSE server | Server-Sent Events for real-time deployment progress. |
| GET | /api/snowflake-connections | `GetSnowflakeConnectionsHandlerFunc` | Read-only. Reads Snowflake config files. |
| POST | /api/connect/open-content | `PostOpenConnectContentHandlerFunc` | Side-effect: downloads bundle from Connect. |

### 1.2 Extension API Call Sites

The extension's API communication is **highly centralized** — a good starting
point for the migration.

**Architecture:**

```
src/api/
├── client.ts              # PublishingClientApi class (axios singleton)
├── index.ts               # Barrel exports
├── resources/             # 13 resource classes (one per domain group)
│   ├── Configurations.ts
│   ├── ConnectCloud.ts
│   ├── ConnectServer.ts
│   ├── ContentRecords.ts
│   ├── Credentials.ts
│   ├── Entrypoints.ts
│   ├── Files.ts
│   ├── IntegrationRequests.ts
│   ├── Interpreters.ts
│   ├── OpenConnectContent.ts
│   ├── Packages.ts
│   ├── Secrets.ts
│   └── SnowflakeConnections.ts
└── types/                 # 17 type definition files
```

**Key patterns:**

- `PublishingClientApi` creates a single axios instance and instantiates all 13
  resource classes.
- `initApi(apiServiceIsUp, baseUrl)` is called once at startup.
- `useApi()` returns the singleton after the Go backend is ready.
- Every resource method returns `AxiosResponse<T>` (not just `T`).
- No HTTP calls exist outside `src/api/resources/`. This is clean.

**Call sites** (consumers of `useApi()`):

- `state.ts` — Central state management, most frequent caller
- `views/homeView.ts` — Main sidebar webview provider (~2100 lines, many calls)
- `views/deployProgress.ts` — Deployment progress tracking
- `multiStepInputs/*.ts` — Wizard-style flows (5 files)
- `authProvider.ts` — VSCode authentication provider
- `events.ts` — SSE client (uses EventSource, not axios)
- `entrypointTracker.ts` — One call for entrypoint detection

**Transformation logic in the extension:**

- `UpdateConfigWithDefaults()` / `UpdateAllConfigsWithDefaults()` — merges
  interpreter defaults into configs after fetching
- `recordAddConnectCloudUrlParams()` — adds URL params for Connect Cloud
- URL normalization utilities
- Type guards for discriminated unions (`isConfigurationError`,
  `isContentRecordError`, `isAgentError`, etc.)

These transformations are domain logic that should move to the core.

### 1.3 External Resources

The Go API interacts with the following external resources. Each will need a
driven port in the new architecture.

#### Remote Services

| Resource | Package | Operations | Auth |
|----------|---------|------------|------|
| **Posit Connect API** | `internal/clients/connect/` | Create/update content, upload/deploy bundles, get settings, get env vars, get integrations, task polling | API key or token |
| **Posit Connect Cloud API** | `internal/clients/connect_cloud/` | Get accounts, get/create/update content, publish, get revisions | OAuth (access/refresh tokens) |
| **Connect Cloud Upload** | `internal/clients/connect_cloud_upload/` | Upload bundles to pre-signed URLs | Pre-signed URL |
| **Connect Cloud Logs** | `internal/clients/connect_cloud_logs/` | Stream deployment logs | OAuth tokens |
| **Cloud Auth (login.posit.cloud)** | `internal/clients/cloud_auth/` | OAuth device flow, token exchange | OAuth client credentials |
| **Snowflake** | `internal/api_client/auth/snowflake/` | Keypair auth for Connect | Snowflake config files |

#### Local Resources

| Resource | Package | Operations |
|----------|---------|------------|
| **File system** (project files) | `internal/bundles/`, `internal/config/`, `internal/deployment/` | Read/write TOML configs, deployment records, create tar.gz bundles, file walking with glob patterns |
| **Credential storage** (keyring) | `internal/credentials/keyring.go` | Store/retrieve credentials via OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service) |
| **Credential storage** (file) | `internal/credentials/file.go` | File-based credential storage at `~/.connect-credentials` (fallback) |
| **Python interpreter** | `internal/interpreters/python.go` | Detect interpreter, get version, detect virtualenvs |
| **R interpreter** | `internal/interpreters/r.go` | Detect interpreter, get version, detect renv |
| **Process execution** | `internal/executor/` | Run Python, R, Quarto commands |
| **Snowflake config files** | `internal/api_client/auth/snowflake/` | Read `~/.snowflake/config.toml` and `connections.toml` |

### 1.4 Existing Test Suite

#### Go Tests

- **Framework:** Testify (suite-based with `mock.Mock`)
- **File system:** All tests use `afero.MemMapFs` for in-memory FS
- **HTTP clients:** Mock implementations for all Connect API clients
- **Executors:** Mock executors for Python/R command execution
- **Functional tests:** Marked with `-short` flag exclusion (require real
  interpreters)
- **Coverage:** Good coverage of API handlers, clients, config parsing, bundle
  creation

These tests serve as a behavioral specification for the TypeScript core.

#### TypeScript Extension Tests

- **Unit tests:** Vitest, in `src/**/*.test.ts` (excluding `src/test/`)
- **Integration tests:** Mocha, in `src/test/` (run in VSCode instance)
- **Webview tests:** Vitest with jsdom, colocated in `webviews/homeView/src/`
- **Mock pattern:** Vitest `vi.fn()` and `vi.mock()` for axios

#### Test Gaps

- The extension's API resource classes have minimal tests (mostly verifying
  axios call shapes)
- The real behavioral tests are in the Go code — these are the ones to port

---

## Phase 1 Observations & Mismatches with Plan

### What matches the plan well

1. **Centralized API calls.** All HTTP calls go through `src/api/resources/`,
   making extraction behind port interfaces straightforward.

2. **Clear domain groupings.** The 13 resource classes map reasonably well to
   domain concepts, though some will merge or split.

3. **Type definitions already exist.** The `src/api/types/` directory has 17
   type files that can inform domain type design.

4. **Go abstractions are clean.** The Go code already uses interfaces for
   clients, file system, executors, and credentials — a good indicator that
   the port interfaces will be natural.

### Where reality diverges from the plan

1. **No root-level npm workspaces today.** The root `package.json` is minimal
   (just Prettier/Husky). The extension has its own `package.json` and the
   webview has another. Setting up workspaces requires restructuring.

2. **The extension uses `module: "preserve"` with bundler resolution.** The
   core package needs `tsc` → ES modules with declaration files. The extension's
   esbuild bundler will need to resolve the workspace dependency. This should
   work but needs verification.

3. **SSE is a separate communication channel.** The plan focuses on REST
   endpoints, but the EventStream (SSE) is equally important — it carries
   deployment progress events. This is not a simple request/response pattern
   and will need its own port design.

4. **The publish operation is complex.** `POST /api/deployments/{name}` is
   async — it starts a deployment, and progress comes back via SSE events. This
   is the most complex use case to migrate and will need careful design.

5. **Credential storage uses OS-level keyring.** The Go code uses
   `go-keyring` which wraps platform-specific credential stores. The TypeScript
   equivalent needs a Node.js keyring library or delegation to the VSCode
   secrets API.

6. **Process execution (Python/R/Quarto).** Detecting interpreters and scanning
   packages requires running external commands. The Go code uses an `Executor`
   interface. The TypeScript core will need an equivalent port.

7. **TOML parsing.** Configurations and deployment records are TOML files. The
   Go code uses a TOML library. The TypeScript core will need one too (or the
   file system port can handle serialization).

8. **Bundle creation.** Creating tar.gz archives with manifest.json involves
   file walking, glob matching, checksum computation, and tar assembly. This is
   significant logic that belongs in the core, with file system access through
   ports.

9. **The extension types are coupled to axios.** All resource methods return
   `AxiosResponse<T>`. Domain types currently live in `src/api/types/`, mixed
   with transport concerns. These need to be separated.

---

## Phase 2: Workspace Structure

```
publisher/
├── packages/
│   ├── core/
│   │   ├── package.json        # "@publisher/core" — zero dependencies
│   │   ├── tsconfig.json       # tsc → ES modules + .d.ts
│   │   └── src/
│   │       ├── core/           # Domain types, errors, port interfaces
│   │       ├── use-cases/      # Use case classes
│   │       └── index.ts        # Public API barrel
│   └── adapters/
│       ├── package.json        # "@publisher/adapters" — may have deps (TOML, etc.)
│       ├── tsconfig.json
│       └── src/                # Platform-independent driven adapter implementations
├── extensions/
│   └── vscode/
│       ├── package.json
│       ├── src/
│       │   ├── adapters/       # VS Code-specific adapters only (SecretStorage, etc.)
│       │   ├── api/            # Legacy Go API client (shrinks as migration progresses)
│       │   └── ...existing code
│       └── ...
└── package.json                # No npm workspaces (vsce compatibility)
```

### Key decisions

- **No npm workspaces.** The extension references `@publisher/core` and
  `@publisher/adapters` via TypeScript `paths` mappings. esbuild follows
  the paths when bundling. This avoids `vsce` packaging issues.

- **`packages/adapters/` is separate from `packages/core/`.** Driven adapters
  like the TOML-based `ConfigurationStore` are platform-independent — any
  driving adapter (VS Code extension, CLI) can use them. Keeping adapters in
  their own package means the core stays dependency-free while adapters can
  take dependencies (TOML library, HTTP client, etc.).

- **VS Code-specific adapters stay in the extension.** Adapters that depend on
  VS Code APIs (e.g. `SecretStorage` for credentials) live in
  `extensions/vscode/src/adapters/` since they can't be shared with a CLI.

---

## Phase 3: Port Interface Design (To Do)

This is the next phase. Based on the inventory above, here are the candidate
domain groupings and their driven ports. **This needs discussion before we
proceed.**

### Candidate Domain Groups

#### 1. Credentials
- **Port:** `CredentialStore`
- **Operations:** list, get, create, delete, reset
- **External resources:** OS keyring, credential file
- **Notes:** The "test credentials" endpoint also hits a remote server — that
  operation might belong under a ConnectClient port instead.

#### 2. Connect Server Communication
- **Port:** `ConnectClient`
- **Operations:** verify auth, get server settings, get integrations, get
  environment vars, create/update content, upload bundle, deploy, poll tasks,
  download bundle
- **External resources:** Posit Connect REST API
- **Notes:** This is the largest port. May want to split into sub-ports
  (e.g. `ConnectContentClient`, `ConnectSettingsClient`).

#### 3. Connect Cloud Communication
- **Port:** `ConnectCloudClient`
- **Operations:** device auth, token exchange, list accounts, get/create/update
  content, publish, get revisions, upload bundles, watch logs
- **External resources:** Connect Cloud API, Cloud Auth, Cloud Upload, Cloud
  Logs

#### 4. Project Configuration
- **Port:** `ConfigurationStore`
- **Operations:** list, get, create/update, delete configs; manage file lists,
  secrets, packages, integration requests within configs
- **External resources:** File system (`.posit/publish/*.toml`)

#### 5. Deployment Records
- **Port:** `DeploymentStore`
- **Operations:** list, get, create, update, delete deployment records
- **External resources:** File system (`.posit/publish/deployments/*.toml`)

#### 6. Project Inspection
- **Port:** `ProjectInspector`
- **Operations:** detect entrypoints, inspect project type, suggest configs
- **External resources:** File system

#### 7. File System (low-level)
- **Port:** `FileSystem`
- **Operations:** read/write files, list directories, walk trees, create
  bundles, compute checksums
- **External resources:** OS file system
- **Notes:** This is a utility port used by other ports/use cases. Consider
  whether the core needs this directly, or whether higher-level ports
  (ConfigurationStore, DeploymentStore) encapsulate file access.

#### 8. Interpreter Detection
- **Port:** `InterpreterResolver`
- **Operations:** find Python interpreter, find R interpreter, get versions
- **External resources:** Process execution (running `python --version` etc.)

#### 9. Package Scanning
- **Port:** `PackageScanner`
- **Operations:** scan Python dependencies, scan R dependencies
- **External resources:** File system + process execution
- **Notes:** Side effects — writes requirements.txt or renv.lock.

#### 10. Snowflake
- **Port:** `SnowflakeConnectionSource`
- **Operations:** list available connections
- **External resources:** Snowflake config files

### Candidate Use Cases

These are the user-facing operations. Each maps to one or more current
endpoints.

| Use Case | Current Endpoint(s) | Driven Ports Needed |
|----------|-------------------|---------------------|
| ListCredentials | GET /credentials | CredentialStore |
| CreateCredential | POST /credentials | CredentialStore |
| DeleteCredential | DELETE /credentials/{guid} | CredentialStore |
| TestCredentials | POST /test-credentials | ConnectClient |
| VerifyAccount | POST /accounts/{name}/verify | ConnectClient, CredentialStore |
| ListConfigurations | GET /configurations | ConfigurationStore |
| CreateOrUpdateConfiguration | PUT /configurations/{name} | ConfigurationStore |
| DeleteConfiguration | DELETE /configurations/{name} | ConfigurationStore |
| InspectProject | POST /inspect | ProjectInspector |
| ListDeployments | GET /deployments | DeploymentStore |
| CreateDeployment | POST /deployments (record creation) | DeploymentStore |
| **Publish** | POST /deployments/{name} (initiates deploy) | ConnectClient or ConnectCloudClient, ConfigurationStore, DeploymentStore, PackageScanner, FileSystem |
| CancelPublish | POST /deployments/{name}/cancel/{localid} | (state management) |
| ScanPythonPackages | POST /packages/python/scan | PackageScanner |
| ScanRPackages | POST /packages/r/scan | PackageScanner |
| DetectInterpreters | GET /interpreters | InterpreterResolver |
| GetServerSettings | GET /accounts/{name}/server-settings | ConnectClient |
| InitiateDeviceAuth | POST /connect-cloud/device-auth | ConnectCloudClient |
| ExchangeDeviceToken | POST /connect-cloud/oauth/token | ConnectCloudClient |
| OpenConnectContent | POST /connect/open-content | ConnectClient |

---

## Open Questions

These need answers before finalizing the port interface design in Phase 3.

1. **SSE replacement.** Currently, deployment progress is streamed via SSE from
   the Go backend. In the TypeScript core, what should the equivalent be?
   Options:
   - EventEmitter-style callbacks on the use case
   - AsyncIterator / ReadableStream
   - A dedicated `ProgressReporter` port

2. **Credential storage in TypeScript.** The Go code uses `go-keyring` for OS
   keyring access. Options for TypeScript:
   - Use VSCode's `SecretStorage` API (only available in extension context)
   - Use a Node.js keyring library (e.g. `keytar`, though it's deprecated)
   - Make credential storage a driven port with two adapters (VSCode secrets
     adapter, file-based adapter)

3. **TOML handling.** The core needs to parse and write TOML for configs and
   deployment records. Should TOML be a port concern (the file system port
   returns/accepts domain objects), or should the core depend on a TOML library
   directly?

4. **Bundle creation scope.** Bundle creation (tar.gz with manifest) is complex
   logic. Does it belong in the core (as a use case), or is it purely an
   adapter concern?

5. **Account list.** The Go code derives accounts from credentials at runtime
   (`accounts.AccountList`). The extension calls `/api/accounts` endpoints. Is
   "account" a distinct domain concept, or is it derived from credentials?

6. **Migration approach.** The plan offers two options:
   - **Option A:** Port interface as migration boundary (extract behind port →
     Go API adapter → swap for TS implementation)
   - **Option B:** Feature flag routing

   Given that the extension's API calls are already centralized in resource
   classes, Option A's extraction step is easy. The resource classes are
   effectively already thin adapters. Recommendation: **Option A**.

---

## Migration Order (Proposed)

Based on dependency order, risk, and value:

1. **Configurations** — Pure file system operations. Low risk. High value
   (validates the architecture with the most-used feature).
2. **Deployment Records** — Similar to configs. Pure file system.
3. **Credentials** — Introduces keyring/secrets as an external resource.
4. **Project Inspection / Entrypoints** — File system + process execution.
5. **Interpreters** — Process execution port.
6. **Package Scanning** — Process execution + file system.
7. **Connect Server Communication** — Large but well-defined HTTP client.
8. **Connect Cloud Communication** — OAuth complexity.
9. **Publish** — The most complex use case. Depends on all of the above.

---

## Status

- [x] Phase 1: Inventory (this document)
- [ ] Phase 2: Workspace structure setup
- [ ] Phase 3: Port interface design
- [ ] Phase 4: Migration strategy finalized
- [ ] Phase 5: Incremental implementation
- [ ] Phase 6: Production hardening
