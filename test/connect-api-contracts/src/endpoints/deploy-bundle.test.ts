import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("DeployBundle", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const bundleId = "201";

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/deploy", async () => {
      const result = await client.call("DeployBundle", {
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}/deploy`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("DeployBundle", {
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends bundle_id in request body", async () => {
      const result = await client.call("DeployBundle", {
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      const body = JSON.parse(result.capturedRequest!.body!);
      expect(body).toEqual({ bundle_id: bundleId });
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("DeployBundle", {
        contentId,
        bundleId,
      });

      expect(result.status).toBe("success");
    });

    it("parses task ID from response", async () => {
      const result = await client.call("DeployBundle", {
        contentId,
        bundleId,
      });
      const body = result.result as { taskId: string };

      expect(body.taskId).toBe("task-abc123-def456");
    });
  });
});
