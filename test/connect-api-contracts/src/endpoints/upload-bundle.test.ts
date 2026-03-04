import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("UploadBundle", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/bundles", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.uploadBundle({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.uploadBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleData,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends Content-Type application/gzip", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.uploadBundle({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.uploadBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleData,
      });

      expect(result.status).toBe("success");
    });

    it("parses bundle ID from response", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const bundleData = new Uint8Array([0x1f, 0x8b]);
      const result = await client.uploadBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleData,
      });
      const body = result.result as { bundleId: string };

      expect(body.bundleId).toBe("201");
    });
  });
});
