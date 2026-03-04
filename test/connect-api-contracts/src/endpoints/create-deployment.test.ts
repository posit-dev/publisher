import { describe, it, expect } from "vitest";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("CreateDeployment", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content", async () => {
      const result = await client.call("CreateDeployment", { body: {} });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/content");
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

      expect(body.contentId).toBe(TEST_CONTENT_ID);
    });
  });
});
