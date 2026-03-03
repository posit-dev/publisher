import { describe, it, expect, beforeEach } from "vitest";
import {
  getClient,
  getMockConnectUrl,
  clearMockRequests,
  clearMockOverrides,
} from "../helpers";

describe("LatestBundleID", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.latestBundleId({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.latestBundleId({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.latestBundleId({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.status).toBe("success");
    });

    it("extracts bundle_id from content DTO", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.latestBundleId({
        connectUrl,
        apiKey,
        contentId,
      });
      const body = result.result as { bundleId: string };

      // content-details.json has bundle_id: "101"
      expect(body.bundleId).toBe("101");
    });
  });
});
