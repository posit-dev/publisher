// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { stripMilliseconds } from "./date";

describe("stripMilliseconds", () => {
  test("strips milliseconds from Go-style timestamp with offset", () => {
    expect(stripMilliseconds("2026-04-02T15:53:21.123-04:00")).toBe(
      "2026-04-02T15:53:21-04:00",
    );
  });

  test("strips milliseconds from JS ISO string ending in Z", () => {
    expect(stripMilliseconds("2026-04-02T19:44:12.936Z")).toBe(
      "2026-04-02T19:44:12Z",
    );
  });

  test("returns Go-style timestamp without millis unchanged", () => {
    expect(stripMilliseconds("2026-04-02T15:53:21-04:00")).toBe(
      "2026-04-02T15:53:21-04:00",
    );
  });

  test("returns Z timestamp without millis unchanged", () => {
    expect(stripMilliseconds("2026-04-02T19:44:12Z")).toBe(
      "2026-04-02T19:44:12Z",
    );
  });

  test("handles positive UTC offset", () => {
    expect(stripMilliseconds("2026-04-02T23:53:21.456+05:30")).toBe(
      "2026-04-02T23:53:21+05:30",
    );
  });
});
