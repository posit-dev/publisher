import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("GetEnvVars", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id/environment", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getEnvVars({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}/environment`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getEnvVars({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getEnvVars({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.status).toBe("success");
    });

    it("parses environment variable name list", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getEnvVars({
        connectUrl,
        apiKey,
        contentId,
      });
      const envVars = result.result as string[];

      expect(envVars).toEqual(["DATABASE_URL", "SECRET_KEY", "API_TOKEN"]);
    });
  });
});
