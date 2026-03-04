import { describe, it, expect } from "vitest";
import { Method } from "../client";
import {
  setupContractTest,
  setMockResponse,
  TEST_CONTENT_ID,
} from "../helpers";

describe("ContentDetails", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id", async () => {
      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("success");
    });

    it("parses ConnectContent fields from response", async () => {
      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });
      const body = result.result as Record<string, unknown>;

      expect(body.guid).toBe(TEST_CONTENT_ID);
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

      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });

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

      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("error");
    });

    it("returns error for 404 not found response", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/content/[^/]+$",
        status: 404,
        body: { code: 4, error: "Content not found" },
      });

      const result = await client.call(Method.ContentDetails, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("error");
    });
  });
});
