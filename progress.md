# Agent Deploy Tools — Progress

## Goal

Add VSCode Language Model Tools to the Publisher extension so an AI agent (Posit
Assistant in Positron, GitHub Copilot, etc.) can inspect a project, confirm a
plan with the user, and deploy it to Posit Connect / Connect Cloud end-to-end —
with secrets never entering tool arguments or model context.

## Background / why this shape

- Investigation started from a Slack thread (skills vs. explicit tools for Posit
  Assistant). Team preference: prefer **skills**, add tools sparingly — too many
  tools distract the model. Positron work in flight (`posit-dev/positron#14693`,
  `#14913`, `posit-dev/assistant#1810`) adds a curated, allow-listed
  `positron.ai` command mechanism with per-command approval and a `source:
'extension'` field.
- Publisher already ships two `LanguageModelTool`s tagged `positron-assistant`
  (`troubleshootDeploymentFailure`, `troubleshootConfigurationError`). We follow
  that same registration pattern rather than depending on the Positron-specific
  allow-list, so the tools are editor-portable.
- Key architecture fact: deployment **preparation** is already headless (plain
  exported functions: `inspectProject`, `getInterpreterDefaults`,
  `writeConfigToFile`, `createDeploymentRecord`, `CredentialsService`,
  `loadAllConfigurations/Deployments`). The deploy **trigger** was webview-only
  (`HomeViewProvider.initiateDeployment` via a `DEPLOY` postMessage), returning
  `void`. That was the one thing that had to be refactored.

## Design decisions (approved)

- **Scope:** full end-to-end deploy + initiate fallback.
- **Three tools** (not one, not the full read-side only):
  - `planDeployment` (read; no confirmation) — inspect dir, existing
    configs/records, redacted credentials.
  - `deployContent` (write + deploy; the confirmation gate) — writes config +
    record if absent, runs deploy, returns structured status/URLs.
  - `addCredential` (initiate-only) — opens the credential-creation UI so the
    user enters the secret there.
- **Secrets boundary:** `planDeployment` strips secret fields; `deployContent`
  takes `credentialName` (never keys); `addCredential` routes secret entry
  through the UI. Env-var secrets (`DeployMsg.secrets`) deferred out of v1.
- **Structured statuses** from `deployContent`: `success | failed |
needs-credential | needs-content-type` (no throws) so the model can branch.

Design spec: `docs/superpowers/specs/2026-07-22-agent-deploy-tools-design.md`
Implementation plan: `docs/superpowers/plans/2026-07-22-agent-deploy-tools.md`
(Both are git-excluded locally per user preference — plans are not committed.)

## Implementation status

Branch: `feat/agent-deploy-tools` (base `895ffe4f3`).

### Done

- **Enabling refactor**
  - `src/views/deployProgress.ts` — added `DeployOutcome` union; `runDeployWithProgress`
    now returns `Promise<DeployOutcome>` (`success`/`failed`/`canceled`) instead
    of `void`. Backward compatible — the existing 38 deployProgress tests pass
    unchanged.
  - `src/views/homeView.ts` — `initiateDeployment` returns the `DeployOutcome`
    (early setup failures mapped to `{status:"failed"}`); added public
    `deployProject(deploymentName, credentialName, configurationName, projectDir)`
    that both the webview path and the tool call.
- **Three tools** in `src/llm/tooling/deploy/`:
  - `redactCredential.ts` — strips secrets to `{name, url, serverType}`.
  - `planDeploymentTool.ts` — `PlanDeploymentTool`.
  - `deployContentTool.ts` — `DeployContentTool` (config/record creation via
    `writeConfigToFile`/`createDeploymentRecord`, names via
    `newConfigFileNameFromTitle`/`newDeploymentName`, deploy via
    `homeViewProvider.deployProject`).
  - `addCredentialTool.ts` — `AddCredentialTool` (executes
    `Commands.HomeView.AddCredential`).
- **Wiring**
  - `src/llm/index.ts` — `registerLLMTooling` now takes `homeViewProvider` and
    registers all three new tools.
  - `src/extension.ts` — passes `homeViewProvider` into `registerLLMTooling`.
  - `package.json` — three `languageModelTools` contributions (tagged
    `posit`/`publisher`/`positron-assistant`, `canBeReferencedInPrompt`, input
    schemas).
- **Tests** (new files, all passing under vitest): `planDeploymentTool.test.ts`
  (2), `deployContentTool.test.ts` (4), `addCredentialTool.test.ts` (1).
  `deployProgress.test.ts` restored to its original 38 and passing.
- `tsc --noEmit` is clean for all changed/new **source** files.

### Not done / remaining

- [ ] **Test lint cleanup** — the three new tool test files trip
      `require-await` (mock `async () => …` arrows with no `await`). ~13 errors.
      Functionally passing; needs the mocks changed to non-async or given an
      `await`/eslint-disable. (User: defer, track here.)
- [ ] Add new-tool unit-test coverage for the `deployProject` delegation on
      `HomeViewProvider` (Task 2 was verified by typecheck + the existing 38 tests,
      not a dedicated unit test).
- [ ] CHANGELOG entry in the **root** `CHANGELOG.md` (reference a tracking
      issue number; create the issue first).
- [ ] Manual end-to-end verification in a chat client that forwards Publisher's
      `positron-assistant`-tagged tools (plan → confirm → deploy; needs-credential →
      addCredential path).
- [ ] Confirm on the `posit-dev/assistant` side that it actually forwards
      contributed `vscode.lm.tools` tagged `positron-assistant` into its request
      (`LanguageModelChatRequestOptions.tools`) — registration alone doesn't put a
      tool in front of a model.

## Learnings / gotchas discovered

- **Pre-existing env breakage — `ajv/dist/2020`.** `node_modules/ajv` is v6.12.6
  but `src/toml/configValidate.ts` (and deploymentValidate/schema) import
  `ajv/dist/2020` (an ajv v8 subpath). This makes ~15 `toml/*` test files fail to
  **collect** and makes `tsc --noEmit` red. It is unrelated to this work
  (files we never touched) — almost certainly a stale `node_modules`; a fresh
  `npm install` (ajv v8) should resolve it. NOT chased here.
- **Tool tests must mock the heavy module graph.** Because the tools import
  `src/toml` / `src/api` / `src/state` (which transitively import the broken
  ajv), the unit tests `vi.mock` those modules so the real graph never loads.
  This keeps the new tests green despite the ajv issue. `@posit-dev/connect-api`
  (for `GUID`) does NOT pull in ajv, so it's safe to import in tests.
- **Plan flaw — "create" vs "append".** The plan said _create_
  `deployProgress.test.ts`; it already existed with 38 tests and got overwritten
  (only 2 left). Restored from HEAD. Lesson: always check whether a test file
  exists and **add** to it; never regenerate.
- **Formatter hook churn.** A PostToolUse formatter reflows files on save and
  has repeatedly produced repo-wide unstaged changes to unrelated files
  (`state.ts`, `logs.ts`, `home.ts`, contract tests, `package-lock.json`, …).
  These are formatting-only noise; `git restore .` clears them. Watch for this
  before committing.
- **vitest `vi.mock` hoisting.** `vi.mock` is hoisted above module scope, so a
  mocked fn referenced inside the factory must be created with `vi.hoisted`
  (fixed the `addCredential` test this way).
- **`workspaces.path()` returns `string | undefined`** — both tools guard for no
  open workspace (the plan assumed a string).

## How to run

```bash
cd extensions/vscode
npm run test-unit -- src/llm/tooling/deploy/ src/views/deployProgress.test.ts   # new tests: 45 passing
npx tsc --noEmit --project tsconfig.json    # red only from pre-existing ajv/chai/storage env issues
```
