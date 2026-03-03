import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("DeployBundle", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const bundleId = "201";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/deploy", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.deployBundle({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.deployBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends bundle_id in request body", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.deployBundle({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.deployBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleId,
      });

      expect(result.status).toBe("success");
    });

    it("parses task ID from response", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.deployBundle({
        connectUrl,
        apiKey,
        contentId,
        bundleId,
      });
      const body = result.result as { taskId: string };

      expect(body.taskId).toBe("task-abc123-def456");
    });
  });
});
