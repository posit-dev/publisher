import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("DownloadBundle", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const bundleId = "101";

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id/bundles/:bid/download", async () => {
      const result = await client.call("DownloadBundle", {
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}/bundles/${bundleId}/download`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("DownloadBundle", {
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("DownloadBundle", {
        contentId,
        bundleId,
      });

      expect(result.status).toBe("success");
    });

    it("returns raw bytes from response", async () => {
      const result = await client.call("DownloadBundle", {
        contentId,
        bundleId,
      });
      const data = result.result as Uint8Array;

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });
  });
});
