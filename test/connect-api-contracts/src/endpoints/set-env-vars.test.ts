import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("SetEnvVars", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends PATCH to /__api__/v1/content/:id/environment", async () => {
      const result = await client.call("SetEnvVars", {
        contentId,
        env: { DATABASE_URL: "postgres://localhost/db" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("PATCH");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${contentId}/environment`,
      );
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("SetEnvVars", {
        contentId,
        env: { DATABASE_URL: "postgres://localhost/db" },
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends env vars as [{name, value}] array body", async () => {
      const result = await client.call("SetEnvVars", {
        contentId,
        env: { DATABASE_URL: "postgres://localhost/db", SECRET: "abc" },
      });

      expect(result.capturedRequest).not.toBeNull();
      const body = JSON.parse(result.capturedRequest!.body!);
      expect(body).toEqual(
        expect.arrayContaining([
          { name: "DATABASE_URL", value: "postgres://localhost/db" },
          { name: "SECRET", value: "abc" },
        ]),
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status for 204 no-body response", async () => {
      const result = await client.call("SetEnvVars", {
        contentId,
        env: { DATABASE_URL: "postgres://localhost/db" },
      });

      expect(result.status).toBe("success");
    });
  });
});
