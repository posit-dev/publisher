import { describe, it, expect, beforeEach } from "vitest";
import {
  getClient,
  getMockConnectUrl,
  clearMockRequests,
  getMockRequests,
} from "../helpers";

describe.skip("GetSettings", () => {
  const apiKey = "test-api-key-12345";

  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests("/__api__/v1/user");
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests("/__api__/server_settings");
      const generalReq = requests.find(
        (r) => r.path === "/__api__/server_settings",
      );
      expect(generalReq).toBeDefined();
      expect(generalReq!.method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings/applications", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests(
        "/__api__/server_settings/applications",
      );
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends GET to /__api__/server_settings/scheduler", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests(
        "/__api__/server_settings/scheduler",
      );
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/python", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests(
        "/__api__/v1/server_settings/python",
      );
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/r", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests("/__api__/v1/server_settings/r");
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends GET to /__api__/v1/server_settings/quarto", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const requests = await getMockRequests(
        "/__api__/v1/server_settings/quarto",
      );
      expect(requests.length).toBeGreaterThanOrEqual(1);
      expect(requests[0].method).toBe("GET");
    });

    it("sends Authorization header on all 7 requests", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      await client.getSettings({ connectUrl, apiKey });

      const allRequests = await getMockRequests();
      expect(allRequests.length).toBeGreaterThanOrEqual(7);

      for (const req of allRequests) {
        expect(req.headers["authorization"]).toBe(`Key ${apiKey}`);
      }
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getSettings({ connectUrl, apiKey });

      expect(result.status).toBe("success");
    });

    it("parses composite settings from all endpoints", async () => {
      const client = getClient();
      const connectUrl = getMockConnectUrl();

      const result = await client.getSettings({ connectUrl, apiKey });
      const settings = result.result as Record<string, unknown>;

      expect(settings).toBeDefined();
    });
  });
});
