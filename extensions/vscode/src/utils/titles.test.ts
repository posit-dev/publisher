// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import {
  configurationFactory,
  contentRecordFactory,
} from "src/test/unit-test-utils/factories";
import { calculateTitle } from "./titles";

describe("calculateTitle", () => {
  it("uses a linked source title when the local configuration has none", () => {
    const record = contentRecordFactory.build({
      configurationName: "connect-session",
    });
    const config = configurationFactory.build({
      configurationName: "connect-session",
    });

    expect(calculateTitle(record, config, "Source app")).toMatchObject({
      title: "Source app",
      problem: false,
    });
  });

  it("keeps a locally configured title ahead of the linked source title", () => {
    const record = contentRecordFactory.build({
      configurationName: "connect-session",
    });
    const config = configurationFactory.build({
      configuration: { title: "Local title" },
      configurationName: "",
    });

    expect(calculateTitle(record, config, "Source app").title).toBe(
      "Local title",
    );
  });
});
