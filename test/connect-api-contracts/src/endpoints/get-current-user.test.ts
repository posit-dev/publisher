import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests } from "../helpers";

describe.skip("GetCurrentUser", () => {
  const apiKey = "test-api-key-12345";

  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getCurrentUser({ connectUrl, apiKey });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/user");
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getCurrentUser({ connectUrl, apiKey });

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

      const result = await client.getCurrentUser({ connectUrl, apiKey });

      expect(result.status).toBe("success");
    });

    it("parses User fields from Connect UserDTO", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getCurrentUser({ connectUrl, apiKey });
      const user = result.result as {
        id: string;
        username: string;
        first_name: string;
        last_name: string;
        email: string;
      };

      expect(user).toEqual({
        id: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        username: "bob",
        first_name: "Bob",
        last_name: "Bobberson",
        email: "bob@example.com",
      });
    });
  });
});
