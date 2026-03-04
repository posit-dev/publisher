import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("LatestBundleID", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id", async () => {
      const result = await client.call(Method.LatestBundleID, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.LatestBundleID, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("success");
    });

    it("extracts bundle_id from content DTO", async () => {
      const result = await client.call(Method.LatestBundleID, {
        contentId: TEST_CONTENT_ID,
      });
      const body = result.result as { bundleId: string };

      // content-details.json has bundle_id: "101"
      expect(body.bundleId).toBe("101");
    });
  });
});
