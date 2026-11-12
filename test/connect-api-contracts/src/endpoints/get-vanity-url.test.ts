// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect } from "vitest";
import { Method } from "../client";
import {
  setMockResponse,
  setupContractTest,
  TEST_CONTENT_ID,
} from "../helpers";

describe("GetVanityURL", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/content/:id/vanity", async () => {
      const result = await client.call(Method.GetVanityURL, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/vanity`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns the vanity path", async () => {
      const result = await client.call(Method.GetVanityURL, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("success");
      expect(result.result).toEqual({ path: "/my-app/" });
    });

    it("returns no path when the content has no vanity URL (404)", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/content/[^/]+/vanity$",
        status: 404,
        body: { code: 4, error: "The requested object does not exist." },
      });

      const result = await client.call(Method.GetVanityURL, {
        contentId: TEST_CONTENT_ID,
      });

      expect(result.status).toBe("success");
      expect(result.result).toEqual({ path: undefined });
    });
  });
});
