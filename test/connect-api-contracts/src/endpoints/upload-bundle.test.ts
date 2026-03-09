// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID, TEST_BUNDLE_ID } from "../helpers";

describe("UploadBundle", () => {
  const { client } = setupContractTest();
  const bundleData = new Uint8Array([0x1f, 0x8b]);

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/bundles", async () => {
      const result = await client.call(Method.UploadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleData,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/bundles`,
      );
    });

    it("sends Content-Type application/gzip", async () => {
      const result = await client.call(Method.UploadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleData,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["content-type"]).toBe(
        "application/gzip",
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.UploadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleData,
      });

      expect(result.status).toBe("success");
    });

    it("parses bundle ID from response", async () => {
      const result = await client.call(Method.UploadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleData,
      });
      const body = result.result as { bundleId: string };

      expect(body.bundleId).toBe(TEST_BUNDLE_ID);
    });
  });
});
