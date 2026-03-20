// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { canUseTsPublishPath } from "src/views/canUseTsPublishPath";
import { ServerType } from "src/api/types/contentRecords";
import { ProductType } from "src/api/types/contentRecords";
import type { ConfigurationDetails } from "src/api/types/configurations";

function makeConfig(
  overrides?: Partial<ConfigurationDetails>,
): ConfigurationDetails {
  return {
    $schema: "",
    productType: ProductType.CONNECT,
    type: "python-dash" as ConfigurationDetails["type"],
    validate: true,
    ...overrides,
  };
}

describe("canUseTsPublishPath", () => {
  it("returns true for plain Connect deployments", () => {
    expect(canUseTsPublishPath(ServerType.CONNECT, makeConfig())).toBe(true);
  });

  it("returns false for Connect Cloud", () => {
    expect(canUseTsPublishPath(ServerType.CONNECT_CLOUD, makeConfig())).toBe(
      false,
    );
  });

  it("returns false for Snowflake", () => {
    expect(canUseTsPublishPath(ServerType.SNOWFLAKE, makeConfig())).toBe(false);
  });

  it("returns false when packagesFromLibrary is true", () => {
    const config = makeConfig({
      r: {
        version: "4.3.0",
        packageFile: "renv.lock",
        packageManager: "renv",
        packagesFromLibrary: true,
      },
    });
    expect(canUseTsPublishPath(ServerType.CONNECT, config)).toBe(false);
  });

  it("returns true when packagesFromLibrary is false", () => {
    const config = makeConfig({
      r: {
        version: "4.3.0",
        packageFile: "renv.lock",
        packageManager: "renv",
        packagesFromLibrary: false,
      },
    });
    expect(canUseTsPublishPath(ServerType.CONNECT, config)).toBe(true);
  });

  it("returns true when r config has no packagesFromLibrary", () => {
    const config = makeConfig({
      r: {
        version: "4.3.0",
        packageFile: "renv.lock",
        packageManager: "renv",
      },
    });
    expect(canUseTsPublishPath(ServerType.CONNECT, config)).toBe(true);
  });

  it("returns true when no r config at all", () => {
    expect(canUseTsPublishPath(ServerType.CONNECT, makeConfig())).toBe(true);
  });
});
