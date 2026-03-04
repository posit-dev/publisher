import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("UpdateDeployment", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends PATCH to /__api__/v1/content/:id", async () => {
      const result = await client.call("UpdateDeployment", {
        contentId,
        body: { title: "Updated Title" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("PATCH");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("UpdateDeployment", {
        contentId,
        body: { title: "Updated Title" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends ConnectContent body as JSON", async () => {
      const body = { title: "Updated Title", description: "New description" };
      const result = await client.call("UpdateDeployment", {
        contentId,
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
      const result = await client.call("UpdateDeployment", {
        contentId,
        body: { title: "Updated Title" },
      });

      expect(result.status).toBe("success");
    });
  });
});
