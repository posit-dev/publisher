import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests, clearMockOverrides } from "../helpers";

describe("GetIntegrations", () => {
  const apiKey = "test-api-key-12345";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/oauth/integrations", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getIntegrations({ connectUrl, apiKey });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        "/__api__/v1/oauth/integrations",
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getIntegrations({ connectUrl, apiKey });

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

      const result = await client.getIntegrations({ connectUrl, apiKey });

      expect(result.status).toBe("success");
    });

    it("parses Integration array with expected fields", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getIntegrations({ connectUrl, apiKey });
      const integrations = result.result as Array<{
        guid: string;
        name: string;
        description: string;
        auth_type: string;
        template: string;
        config: Record<string, unknown>;
        created_time: string;
      }>;

      expect(integrations).toBeInstanceOf(Array);
      expect(integrations.length).toBe(1);
      expect(integrations[0].guid).toBe(
        "int-guid-1234-5678-abcd-ef0123456789",
      );
      expect(integrations[0].name).toBe("My OAuth Integration");
      expect(integrations[0].auth_type).toBe("OAuth2");
    });
  });
});
