// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { canUseTsPublishPath } from "src/views/canUseTsPublishPath";
import { ServerType } from "src/api/types/contentRecords";

describe("canUseTsPublishPath", () => {
  it("returns true for plain Connect deployments", () => {
    expect(canUseTsPublishPath(ServerType.CONNECT)).toBe(true);
  });

  it("returns false for Connect Cloud", () => {
    expect(canUseTsPublishPath(ServerType.CONNECT_CLOUD)).toBe(false);
  });

  it("returns true for Snowflake (routing handled separately)", () => {
    expect(canUseTsPublishPath(ServerType.SNOWFLAKE)).toBe(true);
  });
});
