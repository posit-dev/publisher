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
  `#14913`, `#15077`, `posit-dev/assistant#1810`) adds a curated, allow-listed
  `positron.ai` command mechanism with per-command approval, a `source:
'extension'` field, and (in #15077) a `contributes.commands[].agent`
  extension point so extensions can opt commands into the allow-list from
  `package.json`.
- Publisher already ships two `LanguageModelTool`s tagged `positron-assistant`
  (`troubleshootDeploymentFailure`, `troubleshootConfigurationError`). We expose
  the new deploy tools **both ways** to guarantee compatibility across VSCode and
  Positron:
  1. As `vscode.lm` `LanguageModelTool`s tagged `positron-assistant` (the pattern
     the troubleshoot tools already use). Editor-portable — works in VSCode /
     Copilot and any host that forwards `positron-assistant`-tagged tools.
  2. As agent-invocable VSCode commands declared agent-compatible via the
     `contributes.commands[].agent` extension point (per
     `posit-dev/positron#15077`), so they land in Positron's curated
     `positron.ai` allow-list (`positron.ai.getAgentAllowedCommands()` /
     `validateAndExecuteCommand()`, `posit-dev/positron#14913`). Positron's
     assistant then runs them by id through its generic `positronCommand` tool
     (`posit-dev/assistant#1810`). No runtime feature-detection needed for the
     contribution — the `agent` sub-object is read at manifest-read time and
     ignored by plain VSCode; path 1 still covers hosts without `positron.ai`.

     Mechanism (from #15077): each `contributes.commands` entry gets an `agent`
     object with `description`, ordered positional `args`
     (`{name, description, required, schema}`), and `returns`. The command must
     also be registered with `vscode.commands.registerCommand`.

     Rationale: don't bet on a single host mechanism. The `positron-assistant` tag
     covers hosts that consume `vscode.lm` tools directly; the `agent`-declared
     commands cover Positron's command-driven agent path (the old
     `positronAssistant` contribution is being removed per #14913, so relying on
     the tag alone is a risk in newer Positron).

     Caveat (#15077): agent commands are trust-filtered — only commands from a
     publisher in Positron's `trustedExtensionPublishers`, a built-in extension,
     or core built-ins are surfaced. Publisher's publisher (`posit`) must be
     trusted on the Positron side for path 2 to actually appear; until then path 1
     is the working path. Track this as an external dependency.
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
- **Path 2 — Positron `positron.ai` command allow-list (dual exposure).** DONE.
  - Each tool refactored to expose a public `run(input)` returning the plain
    payload; `invoke()` now just wraps `run()` in a `LanguageModelToolResult`.
    Same logic backs both paths (no duplication). `DeployToolResult` exported.
  - `constants.ts` — added `Commands.Agent.{PlanDeployment,DeployContent,
AddCredential}` (`posit.publisher.agent.*`).
  - `src/llm/index.ts` — constructs the three tool instances once, registers them
    both as `lm.registerTool(...)` (path 1) and as `commands.registerCommand(...)`
    (path 2). Command handlers take **positional** args matching `agent.args`
    order and call `tool.run({...})`.
  - `package.json` — three `contributes.commands` entries with an `agent`
    sub-object (`description`, ordered `args`, `returns`) per
    `posit-dev/positron#15077`; each hidden from the command palette via a
    `menus.commandPalette` `when:false` (positional-arg commands aren't meaningful
    to run by hand).
  - Verified: `tsc --noEmit` clean, `eslint` clean on all changed source,
    45 deploy/deployProgress unit tests still pass.
- **Sidebar selection on a tool deploy (select BEFORE deploy).** DONE.
  - `src/views/homeView.ts` — `deployProject` is now `async`; it calls the new
    public `selectDeployment(deploymentName, projectDir)` **before** delegating to
    `initiateDeployment`, unconditionally. This works because the deploy tool has
    already written the config + record to disk (or they pre-exist) by the time it
    calls `deployProject` — so the user watches progress on the selected target,
    and a failure leaves the attempted deployment selected with its logs.
  - `selectDeployment` refreshes **both** the content-record and configuration
    caches (the newly created config must be in cache for the webview to render
    the selection), finds the record, and hands its `DeploymentSelector` to the
    existing `propagateDeploymentSelection`. No-op if the record can't be found.
    Only the programmatic (tool) path selects — the webview Deploy path manages
    its own selection.
  - New test `src/views/homeViewSelectDeployment.test.ts` (4 tests): imports the
    real `HomeViewProvider` (bypassing its heavy constructor via
    `Object.create(prototype)`), mocks `vscode` + side-effectful modules
    (`src/extension`, `webviewConduit`), and asserts: selectDeployment
    refresh(both)→find→propagate; no-op when not found; deployProject selects
    **before** `initiateDeployment` (via `invocationCallOrder`); deployProject
    still selects even when the deploy fails. All 49 deploy-related tests pass.
- **Tests** (new files, all passing under vitest): `planDeploymentTool.test.ts`
  (2), `deployContentTool.test.ts` (4), `addCredentialTool.test.ts` (1).
  `deployProgress.test.ts` restored to its original 38 and passing.
- `tsc --noEmit` is clean for all changed/new **source** files.

### Not done / remaining

- **Path 2 external dependencies — INVESTIGATED (2026-07-24).** No Publisher code
  change is needed; Path 2 is gated on Positron/Assistant work shipping:
  - ✅ **Trust: already satisfied.** Positron `product.json` has
    `trustedExtensionPublishers: ["posit", "rstudio"]`, and Publisher's
    `package.json` `publisher` is `posit`. So Publisher's `agent`-declared
    commands pass the #15077 trust filter — nothing to do here.
  - ✅ **`positron.ai` API (#14913): MERGED** (2026-07-21) — in Positron `main`.
  - ⚠️ **`contributes.commands[].agent` extension point
    (`posit-dev/positron#15077`, issue `#15075`): OPEN / unmerged, no milestone.**
    This is what reads Publisher's `agent` sub-object and registers the command
    as agent-compatible. Path 2 won't surface until this merges AND ships in a
    Positron release. **Blocker #1.**
  - ⚠️ **Assistant `positronCommand` tool (`posit-dev/assistant#1810`): OPEN /
    unmerged.** This embeds the allow-listed commands in the system prompt and
    runs them via `validateAndExecuteCommand`. Until it ships, the commands
    aren't put in front of the model. **Blocker #2.**
  - Net: once #15077 and assistant#1810 ship, Path 2 works with **zero** further
    Publisher changes (contributions + registered commands are already in place).
    Path 1 (`vscode.lm` tools) works today regardless.
- [ ] Add a light unit test for the Path 2 command handlers' positional-arg →
      `run({...})` mapping (the `run()` bodies are already covered by the 45
      tests; the adapter wiring is not).
- [x] **Test lint cleanup** — DONE. Dropped `async` from the 13 `vi.fn(async () => …)`
      mocks in the three tool test files (callers `await`, which handles plain
      values). `eslint src/llm/tooling/deploy/*.test.ts` is now clean; the 7 tool
      tests still pass.
- [x] Add new-tool unit-test coverage for the `deployProject` delegation on
      `HomeViewProvider` — done via `homeViewSelectDeployment.test.ts` (covers the
      deploy→select delegation and the success/failure branches).
- [x] CHANGELOG entry in the **root** `CHANGELOG.md` — DONE. Created tracking
      issue posit-dev/publisher#4305 and added an `Added` entry under
      `[Unreleased]` referencing it.
- [ ] Manual end-to-end verification in a chat client that forwards Publisher's
      `positron-assistant`-tagged tools (plan → confirm → deploy; needs-credential →
      addCredential path).
- [ ] Confirm on the `posit-dev/assistant` side that it actually forwards
      contributed `vscode.lm.tools` tagged `positron-assistant` into its request
      (`LanguageModelChatRequestOptions.tools`) — registration alone doesn't put a
      tool in front of a model.

## Learnings / gotchas discovered

- **Pre-existing env breakage — `ajv/dist/2020` — RESOLVED.** Was: `node_modules/ajv`
  v6.12.6 while `src/toml/configValidate.ts` imports `ajv/dist/2020` (v8 subpath),
  breaking ~15 `toml/*` test collections and `tsc`. Confirmed it was a stale
  `node_modules`: a fresh root `npm install` pulls ajv v8 and `tsc --noEmit` is now
  fully clean (0 errors). Note: this workspace ships **without** `node_modules`;
  run `npm install` at the repo root first (installs all workspaces).
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
