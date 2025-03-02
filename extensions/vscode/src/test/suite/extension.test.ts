// Copyright (C) 2024 by Posit Software, PBC.

import * as assert from "assert";
import { Extension, extensions } from "vscode";

// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
  test("extension is registered", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extension: Extension<any> =
      extensions.getExtension("posit.publisher")!;
    assert.ok(extension !== undefined);
  });
});
