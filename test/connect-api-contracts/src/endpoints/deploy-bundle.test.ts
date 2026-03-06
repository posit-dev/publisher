// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect } from "vitest";
import { Method } from "../client";
import {
  setupContractTest,
  TEST_CONTENT_ID,
  TEST_BUNDLE_ID,
  TEST_TASK_ID,
} from "../helpers";

describe("DeployBundle", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends POST to /__api__/v1/content/:id/deploy", async () => {
      const result = await client.call(Method.DeployBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId: TEST_BUNDLE_ID,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("POST");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/deploy`,
      );
    });

    it("sends bundle_id in request body", async () => {
      const result = await client.call(Method.DeployBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId: TEST_BUNDLE_ID,
      });

      expect(result.capturedRequest).not.toBeNull();
      const body = JSON.parse(result.capturedRequest!.body!);
      expect(body).toEqual({ bundle_id: TEST_BUNDLE_ID });
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.DeployBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId: TEST_BUNDLE_ID,
      });

      expect(result.status).toBe("success");
    });

    it("parses task ID from response", async () => {
      const result = await client.call(Method.DeployBundle, {
        contentId: TEST_CONTENT_ID,
        bundleId: TEST_BUNDLE_ID,
      });
      const body = result.result as { taskId: string };

      expect(body.taskId).toBe(TEST_TASK_ID);
    });
  });
});
