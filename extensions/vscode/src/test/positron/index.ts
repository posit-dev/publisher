// Copyright (C) 2026 by Posit Software, PBC.

// Mocha entry point for the Positron-only integration tests. This module is
// loaded inside the Positron extension host by
// @posit-dev/positron-test-electron (see scripts/run-positron-tests.mjs),
// which requires it and calls run().
//
// These tests are kept separate from the plain VSCode suite (src/test/suite/)
// because they exercise the Positron API, which is only available when the
// tests run inside Positron rather than vanilla VSCode.

import * as fs from "fs";
import * as path from "path";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    // Runtime discovery on a cold CI machine is slow, so give each test a
    // generous ceiling.
    timeout: 180000,
  });

  const testsRoot = __dirname;
  for (const file of fs.readdirSync(testsRoot)) {
    if (file.endsWith(".test.js")) {
      mocha.addFile(path.resolve(testsRoot, file));
    }
  }

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
