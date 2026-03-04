import { describe, it, expect } from "vitest";
import { setupContractTest, setMockResponse } from "../helpers";

describe("ContentDetails", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id", async () => {
      const result = await client.call("ContentDetails", { contentId });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("ContentDetails", { contentId });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("ContentDetails", { contentId });

      expect(result.status).toBe("success");
    });

    it("parses ConnectContent fields from response", async () => {
      const result = await client.call("ContentDetails", { contentId });
      const body = result.result as Record<string, unknown>;

      expect(body.guid).toBe(contentId);
      expect(body.name).toBe("my-fastapi-app");
      expect(body.app_mode).toBe("python-fastapi");
    });
  });

  describe("error handling", () => {
    it("returns error for 401 unauthorized response", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/content/[^/]+$",
        status: 401,
        body: { code: 3, error: "Key is not valid" },
      });

      const result = await client.call("ContentDetails", { contentId });

      expect(result.status).toBe("error");
    });

    it("returns error for 403 forbidden response", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/content/[^/]+$",
        status: 403,
        body: {
          code: 4,
          error: "You do not have permission to perform this operation",
        },
      });

      const result = await client.call("ContentDetails", { contentId });

      expect(result.status).toBe("error");
    });

    it("returns error for 404 not found response", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/content/[^/]+$",
        status: 404,
        body: { code: 4, error: "Content not found" },
      });

      const result = await client.call("ContentDetails", { contentId });

      expect(result.status).toBe("error");
    });
  });
});
