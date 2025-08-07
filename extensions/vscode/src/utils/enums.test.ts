// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import { getEnumKeyByEnumValue } from "./enums";

enum myEnum {
  FOO = "bar",
  BAZ = "moo",
  HAM = "spam",
}

describe("getEnumKeyByEnumValue", () => {
  test.each([
    //  value, expected
    ["bar", "FOO"],
    ["moo", "BAZ"],
    ["spam", "HAM"],
    ["random", undefined],
  ])(
    `When enum value: "%s" is passed in, it returns enum key: "%s"`,
    (value, expected) => {
      const result = getEnumKeyByEnumValue(myEnum, value);
      expect(result).toBe(expected);
    },
  );
});
