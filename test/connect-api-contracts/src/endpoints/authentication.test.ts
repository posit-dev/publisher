import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests } from "../helpers";

describe("TestAuthentication", () => {
  const apiKey = "test-api-key-12345";

  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/user");
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });

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

      const result = await client.testAuthentication({ connectUrl, apiKey });

      expect(result.status).toBe("success");
    });

    it("parses user fields from Connect UserDTO", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });
      const body = result.result as {
        user: {
          id: string;
          username: string;
          first_name: string;
          last_name: string;
          email: string;
        };
      };

      // Publisher maps Connect's UserDTO (12 fields) down to User (5 fields)
      expect(body.user).toEqual({
        id: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        username: "bob",
        first_name: "Bob",
        last_name: "Bobberson",
        email: "bob@example.com",
      });
    });

    it("returns serverType as connect", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });
      const body = result.result as { serverType: string };

      expect(body.serverType).toBe("connect");
    });

    it("returns the mock Connect URL", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });
      const body = result.result as { url: string };

      expect(body.url).toBe(connectUrl);
    });

    it("returns null error on success", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });
      const body = result.result as { error: unknown };

      expect(body.error).toBeNull();
    });
  });

  describe("snapshot", () => {
    it("matches expected response shape", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.testAuthentication({ connectUrl, apiKey });

      // Mask dynamic URL for snapshot stability
      const body = result.result as Record<string, unknown>;
      const snapshot = { ...body, url: "{{MOCK_CONNECT_URL}}" };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "error": null,
          "serverType": "connect",
          "url": "{{MOCK_CONNECT_URL}}",
          "user": {
            "email": "bob@example.com",
            "first_name": "Bob",
            "id": "40d1c1dc-d554-4905-99f1-359517e1a7c0",
            "last_name": "Bobberson",
            "username": "bob",
          },
        }
      `);
    });
  });
});
