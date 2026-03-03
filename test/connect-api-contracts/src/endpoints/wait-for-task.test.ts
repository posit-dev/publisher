import { describe, it, expect, beforeEach } from "vitest";
import {
  getClient,
  getMockConnectUrl,
  clearMockRequests,
  clearMockOverrides,
  setMockResponse,
} from "../helpers";

describe("WaitForTask", () => {
  const apiKey = "test-api-key-12345";
  const taskId = "task-abc123-def456";

  beforeEach(async () => {
    await clearMockOverrides();
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/tasks/:id", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toMatch(
        /^\/__api__\/v1\/tasks\/task-abc123-def456/,
      );
    });

    it("includes first query parameter for pagination", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.path).toContain("first=");
    });

    it("sends Authorization header with Key prefix", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status when task finishes with code 0", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });

      expect(result.status).toBe("success");
    });

    it("returns finished indicator", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });
      const task = result.result as { finished: boolean };

      expect(task.finished).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns error when task finishes with non-zero exit code", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/tasks/",
        status: 200,
        body: {
          id: "task-abc123-def456",
          output: [
            "Building Python application...",
            "Bundle requested Python version 3.11.6",
            "Error code: python-package-install-failed",
          ],
          result: null,
          finished: true,
          code: 1,
          error: "Error code: python-package-install-failed",
          last: 3,
        },
      });

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });

      expect(result.status).toBe("error");
    });
  });
});
