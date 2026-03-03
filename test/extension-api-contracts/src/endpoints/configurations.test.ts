import { describe, it, expect, beforeEach } from "vitest";
import { getClient, clearMockRequests, getMockRequests } from "../helpers";

describe("Configurations", () => {
  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("getConfigurations (GET /configurations)", () => {
    describe("request correctness", () => {
      it("sends GET to /configurations", async () => {
        const client = getClient();
        await client.getConfigurations("/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/configurations");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.getConfigurations("/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("accepts content-type application/json", async () => {
        const client = getClient();
        await client.getConfigurations("/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].headers["accept"]).toContain("application/json");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.getConfigurations("/workspace");
        expect(result.status).toBe("success");
      });

      it("returns array of configurations", async () => {
        const client = getClient();
        const result = await client.getConfigurations("/workspace");
        expect(result.result).toBeInstanceOf(Array);

        const configs = result.result as any[];
        expect(configs.length).toBeGreaterThan(0);
      });

      it("parses configuration fields", async () => {
        const client = getClient();
        const result = await client.getConfigurations("/workspace");

        const configs = result.result as any[];
        const first = configs[0];
        expect(first.configurationName).toBe("my-app");
        expect(first.configuration).toBeDefined();
        expect(first.configuration.type).toBe("python-fastapi");
        expect(first.configuration.entrypoint).toBe("app.py");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.getConfigurations("/workspace");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("getConfiguration (GET /configurations/:name)", () => {
    describe("request correctness", () => {
      it("sends GET to /configurations/:name", async () => {
        const client = getClient();
        await client.getConfiguration("my-app", "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/configurations/my-app");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.getConfiguration("my-app", "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("encodes special characters in name", async () => {
        const client = getClient();
        await client.getConfiguration("my app/config", "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].path).toBe("/configurations/my%20app%2Fconfig");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.getConfiguration("my-app", "/workspace");
        expect(result.status).toBe("success");
      });

      it("returns a single configuration object", async () => {
        const client = getClient();
        const result = await client.getConfiguration("my-app", "/workspace");

        const config = result.result as any;
        expect(config.configurationName).toBe("my-app");
        expect(config.configuration).toBeDefined();
        expect(config.configuration.type).toBe("python-fastapi");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.getConfiguration("my-app", "/workspace");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("createOrUpdateConfiguration (PUT /configurations/:name)", () => {
    const newConfig = {
      type: "python-fastapi",
      entrypoint: "app.py",
      files: ["app.py", "requirements.txt"],
      python: {
        version: "3.11.3",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
    };

    describe("request correctness", () => {
      it("sends PUT to /configurations/:name", async () => {
        const client = getClient();
        await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("PUT");
        expect(requests[0].path).toBe("/configurations/new-config");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("sends configuration as JSON body", async () => {
        const client = getClient();
        await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].body).not.toBeNull();
        const body = JSON.parse(requests[0].body!);
        expect(body.type).toBe("python-fastapi");
        expect(body.entrypoint).toBe("app.py");
      });

      it("sends Content-Type application/json header", async () => {
        const client = getClient();
        await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].headers["content-type"]).toContain("application/json");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");
        expect(result.status).toBe("success");
      });

      it("returns the created configuration", async () => {
        const client = getClient();
        const result = await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");

        const config = result.result as any;
        expect(config.configurationName).toBe("new-config");
        expect(config.configuration).toBeDefined();
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.createOrUpdateConfiguration("new-config", newConfig, "/workspace");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("deleteConfiguration (DELETE /configurations/:name)", () => {
    describe("request correctness", () => {
      it("sends DELETE to /configurations/:name", async () => {
        const client = getClient();
        await client.deleteConfiguration("my-app", "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("DELETE");
        expect(requests[0].path).toBe("/configurations/my-app");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.deleteConfiguration("my-app", "/workspace");

        const requests = await getMockRequests("/configurations");
        expect(requests[0].query.dir).toBe("/workspace");
      });
    });

    describe("response parsing", () => {
      it("returns success status for 204 response", async () => {
        const client = getClient();
        const result = await client.deleteConfiguration("my-app", "/workspace");
        expect(result.status).toBe("success");
      });
    });
  });
});
