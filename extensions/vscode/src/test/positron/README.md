# Positron API Tests

Integration tests that run the Publisher extension inside a real
[Positron](https://positron.posit.co/) build and exercise its use of the
Positron API — code paths that the plain VSCode suite (`src/test/suite/`) and
the mock-based contract tests (`test/extension-contract-tests/`) can't reach.

Part of the rollout tracked in
[posit-dev/positron#14531](https://github.com/posit-dev/positron/issues/14531).

## How it works

- `scripts/run-positron-tests.mjs` uses
  [`@posit-dev/positron-test-electron`](https://github.com/posit-dev/positron-test-electron)
  to download (and cache, under `.positron-test/`) a Positron build, then runs
  the compiled Mocha entry point (`out/test/positron/index.js`) inside its
  extension host — the Positron analog of `@vscode/test-electron`.
- `index.ts` is that entry point: it discovers `*.test.js` files in this
  directory and runs them with Mocha (tdd UI).
- Tests are compiled by `esbuild.tests.mjs` along with the plain suite; the
  two are kept apart by directory (`out/test/suite/` vs `out/test/positron/`).
- Positron's bundled extensions are left enabled (no `--disable-extensions`)
  because runtime discovery — which Publisher's interpreter resolution relies
  on — is provided by the bundled Python and Ark (R) extensions.

## Running locally

```bash
npm run test-positron          # against the latest stable Positron
POSITRON_CHANNEL=daily npm run test-positron   # against a daily build
```

> **Note:** `@posit-dev/positron-test-electron` currently supports **macOS
> only**. On other platforms, rely on the `Positron-API-Tests` GitHub Actions
> workflow (`.github/workflows/positron-api-tests.yaml`), which runs on every
> PR and push to `main`.

The interpreter-discovery tests expect a Python and an R installation that
Positron can discover on the machine.

## Adding tests

Add a `<name>.test.ts` file in this directory using Mocha's tdd UI
(`suite`/`test`). Things to know:

- The Positron API is reached through the `acquirePositronApi()` global that
  Positron injects into the extension host (typed by
  `src/@types/positron.d.ts`). Publisher's own code feature-detects Positron
  the same way (`src/utils/vscode.ts`).
- Prefer testing Publisher's real behavior at the API boundary: import the
  extension source (e.g. `import { ... } from "src/utils/vscode"`) and assert
  on what it sends to / receives from the live API.
- Runtime discovery is asynchronous and can be slow on cold CI machines; wait
  for Positron to report a runtime before asserting on code that depends on
  one (see `waitForPreferredRuntime` in `interpreter-discovery.test.ts`).
- Keep tests independent of a live kernel actually starting whenever possible
  — metadata-level assertions (`getPreferredRuntime`) are much faster and less
  flaky than session-level ones.
