import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("UpdateDeployment", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends PATCH to /__api__/v1/content/:id", async () => {
      const result = await client.call(Method.UpdateDeployment, {
        contentId: TEST_CONTENT_ID,
        body: { title: "Updated Title" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("PATCH");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}`,
      );
    });

    it("sends ConnectContent body as JSON", async () => {
      const body = { title: "Updated Title", description: "New description" };
      const result = await client.call(Method.UpdateDeployment, {
        contentId: TEST_CONTENT_ID,
        body,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["content-type"]).toContain(
        "application/json",
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status for 204 no-body response", async () => {
      const result = await client.call(Method.UpdateDeployment, {
        contentId: TEST_CONTENT_ID,
        body: { title: "Updated Title" },
      });

      expect(result.status).toBe("success");
    });
  });
});
