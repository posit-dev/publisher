// Copyright (C) 2026 by Posit Software, PBC.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudAuthClient } from "./auth.js";
import { CloudEnvironment } from "./types.js";

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------

const mockPost = vi.fn();

vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

interface Fixture {
  method: string;
  path: string;
  query: string;
  request_body: unknown | null;
  status_code: number;
  response_body: unknown | null;
}

const TESTDATA_DIR = join(__dirname, "..", "testdata");

function loadFixture(name: string): Fixture {
  const filePath = join(TESTDATA_DIR, `${name}.json`);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Fixture;
}

function fixtureExists(name: string): boolean {
  return existsSync(join(TESTDATA_DIR, `${name}.json`));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
  mockPost.mockReset();
});

// ---------------------------------------------------------------------------
// Check if testdata directory exists
// ---------------------------------------------------------------------------

const hasTestdata = existsSync(TESTDATA_DIR);

// ---------------------------------------------------------------------------
// Golden fixture tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasTestdata)("Auth golden fixture tests", () => {
  describe.skipIf(!fixtureExists("device_auth"))("createDeviceAuth", () => {
    it("deserializes the golden fixture response", async () => {
      const fixture = loadFixture("device_auth");
      mockPost.mockResolvedValue({
        data: fixture.response_body,
      });

      const client = new CloudAuthClient(CloudEnvironment.Production);
      const result = await client.createDeviceAuth();

      expect(result).toEqual(fixture.response_body);
    });
  });
});
