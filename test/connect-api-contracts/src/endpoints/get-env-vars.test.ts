import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("GetEnvVars", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id/environment", async () => {
      const result = await client.call(Method.GetEnvVars, { contentId: TEST_CONTENT_ID });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/environment`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.GetEnvVars, { contentId: TEST_CONTENT_ID });

      expect(result.status).toBe("success");
    });

    it("parses environment variable name list", async () => {
      const result = await client.call(Method.GetEnvVars, { contentId: TEST_CONTENT_ID });
      const envVars = result.result as string[];

      expect(envVars).toEqual(["DATABASE_URL", "SECRET_KEY", "API_TOKEN"]);
    });
  });
});
