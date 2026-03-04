import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("LatestBundleID", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id", async () => {
      const result = await client.call("LatestBundleID", { contentId });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("LatestBundleID", { contentId });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("LatestBundleID", { contentId });

      expect(result.status).toBe("success");
    });

    it("extracts bundle_id from content DTO", async () => {
      const result = await client.call("LatestBundleID", { contentId });
      const body = result.result as { bundleId: string };

      // content-details.json has bundle_id: "101"
      expect(body.bundleId).toBe("101");
    });
  });
});
