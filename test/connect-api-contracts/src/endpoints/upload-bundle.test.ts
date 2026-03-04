import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("UploadBundle", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/bundles", async () => {
      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.call("UploadBundle", {
        contentId,
        bundleData,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}/bundles`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.call("UploadBundle", {
        contentId,
        bundleData,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends Content-Type application/gzip", async () => {
      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.call("UploadBundle", {
        contentId,
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
      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.call("UploadBundle", {
        contentId,
        bundleData,
      });

      expect(result.status).toBe("success");
    });

    it("parses bundle ID from response", async () => {
      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.call("UploadBundle", {
        contentId,
        bundleData,
      });
      const body = result.result as { bundleId: string };

      expect(body.bundleId).toBe("201");
    });
  });
});
