// Copyright (C) 2026 by Posit Software, PBC.

// Positron-only integration test.
//
// Publisher's Positron integration is interpreter discovery:
// getPythonInterpreterPath() and getRInterpreterPath() (src/utils/vscode.ts)
// ask Positron for the preferred runtime via
// positron.runtime.getPreferredRuntime() before falling back to the VSCode
// mechanisms. These tests run inside a real Positron build and assert that
// Publisher resolves the same interpreter Positron itself reports — covering
// the API acquisition, the retry loop, and the `~/` expansion of runtime
// paths, none of which is reachable in vanilla VSCode.

import * as assert from "assert";
import os from "node:os";
import path from "node:path";
import { LanguageRuntimeMetadata } from "positron";
import {
  getPythonInterpreterPath,
  getRInterpreterPath,
} from "src/utils/vscode";

/**
 * Runtime discovery starts when Positron boots and can take a while on a cold
 * CI machine. Wait until Positron itself reports a preferred runtime before
 * exercising Publisher's discovery, so the tests measure Publisher's behavior
 * rather than discovery timing.
 */
async function waitForPreferredRuntime(
  languageId: string,
): Promise<LanguageRuntimeMetadata> {
  const api = acquirePositronApi();
  const deadline = Date.now() + 120000;
  let lastError: unknown;

  for (;;) {
    try {
      const runtime = await api.runtime.getPreferredRuntime(languageId);
      if (runtime) {
        return runtime;
      }
    } catch (error: unknown) {
      lastError = error;
    }
    assert.ok(
      Date.now() < deadline,
      `Positron did not report a preferred ${languageId} runtime before the ` +
        `deadline; is a ${languageId} interpreter installed? ` +
        `Last error: ${String(lastError)}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Positron may report runtime paths with a leading `~/`, which Publisher
 * expands before use (https://github.com/posit-dev/positron/issues/12942).
 * Mirror that expansion so the expected value matches on machines where
 * Positron reports home-relative paths.
 */
function expandTilde(runtimePath: string): string {
  return runtimePath.startsWith("~/")
    ? path.join(os.homedir(), runtimePath.slice(1))
    : runtimePath;
}

suite("Positron: interpreter discovery", () => {
  test("resolves the Python interpreter from Positron's preferred runtime", async () => {
    const runtime = await waitForPreferredRuntime("python");

    const python = await getPythonInterpreterPath();
    assert.ok(
      python,
      "Publisher should resolve a Python interpreter in Positron",
    );
    assert.strictEqual(python.pythonPath, expandTilde(runtime.runtimePath));
  });

  test("resolves the R interpreter from Positron's preferred runtime", async () => {
    const runtime = await waitForPreferredRuntime("r");

    const r = await getRInterpreterPath();
    assert.ok(r, "Publisher should resolve an R interpreter in Positron");
    assert.strictEqual(r.rPath, expandTilde(runtime.runtimePath));
  });
});
