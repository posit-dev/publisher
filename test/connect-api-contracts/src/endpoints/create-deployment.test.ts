import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("CreateDeployment", () => {
  const { client, apiKey } = setupContractTest();
  const contentId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content", async () => {
      const result = await client.call("CreateDeployment", { body: {} });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/content");
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("CreateDeployment", { body: {} });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });

    it("sends ConnectContent body as JSON", async () => {
      const body = { name: "my-app", title: "My App" };
      const result = await client.call("CreateDeployment", { body });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["content-type"]).toContain(
        "application/json",
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("CreateDeployment", { body: {} });

      expect(result.status).toBe("success");
    });

    it("parses content GUID from response", async () => {
      const result = await client.call("CreateDeployment", { body: {} });
      const body = result.result as { contentId: string };

      expect(body.contentId).toBe(contentId);
    });
  });
});
