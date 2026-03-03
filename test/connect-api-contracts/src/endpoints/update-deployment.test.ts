import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("UpdateDeployment", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends PATCH to /__api__/v1/content/:id", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.updateDeployment({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.updateDeployment({
        connectUrl,
        apiKey,
        contentId,
        body: { title: "Updated Title" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends ConnectContent body as JSON", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const body = { title: "Updated Title", description: "New description" };
      const result = await client.updateDeployment({
        connectUrl,
        apiKey,
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
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.updateDeployment({
        connectUrl,
        apiKey,
        contentId,
        body: { title: "Updated Title" },
      });

      expect(result.status).toBe("success");
    });
  });
});
