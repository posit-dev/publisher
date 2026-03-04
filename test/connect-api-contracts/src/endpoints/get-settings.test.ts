import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest, TEST_API_KEY } from "../helpers";
import type { CapturedRequest } from "../mock-connect-server";

describe("GetSettings", () => {
  const { client } = setupContractTest();

  async function callAndCapture() {
    const result = await client.call(Method.GetSettings);
    const all = (result.capturedRequests ?? []) as CapturedRequest[];
    return { result, all };
  }

  function filterByPath(requests: CapturedRequest[], pathFragment: string) {
    return requests.filter((r) => r.path.includes(pathFragment));
  }

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(all, "/__api__/v1/user");
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings", async () => {
      const { all } = await callAndCapture();
      const generalReq = all.find((r) => r.path === "/__api__/server_settings");
      expect(generalReq).toBeDefined();
      expect(generalReq!.method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings/applications", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(
        all,
        "/__api__/server_settings/applications",
      );
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings/scheduler", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(all, "/__api__/server_settings/scheduler");
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/python", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(all, "/__api__/v1/server_settings/python");
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/r", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(all, "/__api__/v1/server_settings/r");
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/quarto", async () => {
      const { all } = await callAndCapture();
      const matched = filterByPath(all, "/__api__/v1/server_settings/quarto");
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].method).toBe("GET");
    });

    it("sends Authorization header on all 7 requests", async () => {
      const { all } = await callAndCapture();
      expect(all.length).toBeGreaterThanOrEqual(7);

      for (const req of all) {
        expect(req.headers["authorization"]).toBe(`Key ${TEST_API_KEY}`);
      }
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const { result } = await callAndCapture();
      expect(result.status).toBe("success");
    });

    it("parses composite settings from all endpoints", async () => {
      const { result } = await callAndCapture();
      const settings = result.result as Record<string, unknown>;
      expect(settings).toBeDefined();
    });
  });
});
