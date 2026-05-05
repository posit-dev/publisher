// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { hasPythonImports } from "./pythonImports";

describe("hasPythonImports", () => {
  test("detects 'import flask'", () => {
    expect(hasPythonImports("import flask\n", ["flask"])).toBe(true);
  });

  test("detects 'from flask import Flask'", () => {
    expect(hasPythonImports("from flask import Flask\n", ["flask"])).toBe(true);
  });

  test("detects 'from flask.views import MethodView'", () => {
    expect(
      hasPythonImports("from flask.views import MethodView\n", ["flask"]),
    ).toBe(true);
  });

  test("returns false when no matching imports", () => {
    expect(hasPythonImports("import os\nimport sys\n", ["flask"])).toBe(false);
  });

  test("checks multiple packages", () => {
    expect(
      hasPythonImports("import starlette\n", ["fastapi", "starlette"]),
    ).toBe(true);
  });

  test("returns false for empty content", () => {
    expect(hasPythonImports("", ["flask"])).toBe(false);
  });

  test("matches import in comments", () => {
    // The regex doesn't exclude comments — it's a simple substring match
    expect(hasPythonImports("# import flask\n", ["flask"])).toBe(true);
  });
});
