import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("DownloadBundle", () => {
  const { client } = setupContractTest();
  const bundleId = "101";

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id/bundles/:bid/download", async () => {
      const result = await client.call(Method.DownloadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/bundles/${bundleId}/download`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.DownloadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId,
      });

      expect(result.status).toBe("success");
    });

    it("returns raw bytes from response", async () => {
      const result = await client.call(Method.DownloadBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId,
      });
      const data = result.result as Uint8Array;

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });
  });
});
