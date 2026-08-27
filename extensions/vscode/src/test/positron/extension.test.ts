// Copyright (C) 2026 by Posit Software, PBC.

// Positron-only integration test.
//
// Sanity checks for the contract Publisher depends on when running inside
// Positron: the extension host injects an `acquirePositronApi` global (which
// tryAcquirePositronApi() reads to feature-detect Positron — see
// src/utils/vscode.ts), and the Publisher extension activates.

import * as assert from "assert";
import { extensions } from "vscode";
import { inPositron, tryAcquirePositronApi } from "@posit-dev/positron";

suite("Positron: extension host", () => {
  test("Positron injects the acquirePositronApi global", () => {
    assert.ok(
      inPositron(),
      "the extension host should provide the acquirePositronApi global",
    );

    const api = tryAcquirePositronApi();
    assert.ok(api, "tryAcquirePositronApi() should return the Positron API");
    assert.strictEqual(typeof api.version, "string");
    assert.ok(
      api.version.length > 0,
      "the Positron API should report a version",
    );
  });

  test("Publisher activates in Positron", async () => {
    const publisher = extensions.getExtension("posit.publisher");
    assert.ok(
      publisher,
      "posit.publisher should be present in the extension host",
    );

    await publisher.activate();
    assert.ok(publisher.isActive, "Publisher should activate without error");
  });
});
