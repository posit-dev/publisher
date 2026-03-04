import { describe, it, expect } from "vitest";
import { setupContractTest, setMockResponse, TEST_CONTENT_ID } from "../helpers";

describe("ValidateDeployment", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /content/:id/ (non-API path)", async () => {
      const result = await client.call("ValidateDeployment", { contentId: TEST_CONTENT_ID });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(`/content/${TEST_CONTENT_ID}/`);
    });
  });

  describe("response parsing", () => {
    it("returns success status for 200 response", async () => {
      const result = await client.call("ValidateDeployment", { contentId: TEST_CONTENT_ID });

      expect(result.status).toBe("success");
    });
  });

  describe("error handling", () => {
    it("returns error when content responds with 500", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/content/[^/]+/$",
        status: 500,
        body: "<html>Internal Server Error</html>",
        contentType: "text/html",
      });

      const result = await client.call("ValidateDeployment", { contentId: TEST_CONTENT_ID });

      expect(result.status).toBe("error");
    });

    it("returns success when content responds with 404", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/content/[^/]+/$",
        status: 404,
        body: "<html>Not Found</html>",
        contentType: "text/html",
      });

      const result = await client.call("ValidateDeployment", { contentId: TEST_CONTENT_ID });

      // 404 is acceptable — content may not be running yet
      expect(result.status).toBe("success");
    });
  });
});
