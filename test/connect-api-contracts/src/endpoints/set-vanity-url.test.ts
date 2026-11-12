// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_CONTENT_ID } from "../helpers";

describe("SetVanityURL", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends PUT to /__api__/v1/content/:id/vanity", async () => {
      const result = await client.call(Method.SetVanityURL, {
        contentId: TEST_CONTENT_ID,
        path: "/my-app/",
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("PUT");
      expect(result.capturedRequest!.path).toBe(
        `/__api__/v1/content/${TEST_CONTENT_ID}/vanity`,
      );
    });

    it("sends the path as the request body", async () => {
      const result = await client.call(Method.SetVanityURL, {
        contentId: TEST_CONTENT_ID,
        path: "/my-app/",
      });

      expect(result.capturedRequest).not.toBeNull();
      expect(JSON.parse(result.capturedRequest!.body!)).toEqual({
        path: "/my-app/",
      });
    });
  });

  describe("response parsing", () => {
    it("returns success status for 200 response", async () => {
      const result = await client.call(Method.SetVanityURL, {
        contentId: TEST_CONTENT_ID,
        path: "/my-app/",
      });

      expect(result.status).toBe("success");
    });
  });
});
