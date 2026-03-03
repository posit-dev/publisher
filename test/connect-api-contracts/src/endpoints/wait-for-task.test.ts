import { describe, it, expect, beforeEach } from "vitest";
import { getClient, getMockConnectUrl, clearMockRequests } from "../helpers";

describe.skip("WaitForTask", () => {
  const apiKey = "test-api-key-12345";
  const taskId = "task-abc123-def456";

  beforeEach(async () => {
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

    it("parses task output lines", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.waitForTask({
        connectUrl,
        apiKey,
        taskId,
      });
      const task = result.result as { finished: boolean; output: string[] };

      expect(task.finished).toBe(true);
      expect(task.output).toBeInstanceOf(Array);
      expect(task.output.length).toBeGreaterThan(0);
    });
  });
});
