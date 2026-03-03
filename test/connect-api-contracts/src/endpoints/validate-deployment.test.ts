import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests } from "../helpers";

describe.skip("ValidateDeployment", () => {
  const apiKey = "test-api-key-12345";
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /content/:id/ (non-API path)", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.validateDeployment({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(`/content/${contentId}/`);
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.validateDeployment({
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
    it("returns success status for 200 response", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.validateDeployment({
        connectUrl,
        apiKey,
        contentId,
      });

      expect(result.status).toBe("success");
    });
  });
});
