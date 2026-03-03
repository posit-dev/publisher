import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("CreateDeployment", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.createDeployment({
        connectUrl,
        apiKey,
        body: {},
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/content");
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.createDeployment({
        connectUrl,
        apiKey,
        body: {},
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends ConnectContent body as JSON", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const body = { name: "my-app", title: "My App" };
      const result = await client.createDeployment({
        connectUrl,
        apiKey,
        body,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["content-type"]).toContain(
        "application/json",
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.createDeployment({
        connectUrl,
        apiKey,
        body: {},
      });

      expect(result.status).toBe("success");
    });

    it("parses content GUID from response", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.createDeployment({
        connectUrl,
        apiKey,
        body: {},
      });
      const body = result.result as { contentId: string };

      expect(body.contentId).toBe(contentId);
    });
  });
});
