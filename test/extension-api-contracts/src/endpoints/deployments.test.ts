import { describe, it, expect, beforeEach } from "vitest";
import { getClient, clearMockRequests, getMockRequests } from "../helpers";

describe("Deployments", () => {
  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("getDeployments (GET /deployments)", () => {
    describe("request correctness", () => {
      it("sends GET to /deployments", async () => {
        const client = getClient();
        await client.getDeployments("/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/deployments");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.getDeployments("/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].query.dir).toBe("/workspace");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.getDeployments("/workspace");
        expect(result.status).toBe("success");
      });

      it("returns array of deployments", async () => {
        const client = getClient();
        const result = await client.getDeployments("/workspace");
        expect(result.result).toBeInstanceOf(Array);

        const deployments = result.result as any[];
        expect(deployments.length).toBeGreaterThan(0);
      });

      it("parses deployment fields", async () => {
        const client = getClient();
        const result = await client.getDeployments("/workspace");

        const deployments = result.result as any[];
        const first = deployments[0];
        expect(first.deploymentName).toBe("my-deployment");
        expect(first.state).toBe("deployed");
        expect(first.serverType).toBe("connect");
        expect(first.serverUrl).toBe("https://connect.example.com");
        expect(first.configurationName).toBe("my-app");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.getDeployments("/workspace");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("getDeployment (GET /deployments/:id)", () => {
    describe("request correctness", () => {
      it("sends GET to /deployments/:id", async () => {
        const client = getClient();
        await client.getDeployment("my-deployment", "/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/deployments/my-deployment");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.getDeployment("my-deployment", "/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("encodes special characters in id", async () => {
        const client = getClient();
        await client.getDeployment("my deploy/name", "/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].path).toBe("/deployments/my%20deploy%2Fname");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.getDeployment("my-deployment", "/workspace");
        expect(result.status).toBe("success");
      });

      it("returns a single deployment object", async () => {
        const client = getClient();
        const result = await client.getDeployment("my-deployment", "/workspace");

        const deployment = result.result as any;
        expect(deployment.deploymentName).toBe("my-deployment");
        expect(deployment.state).toBe("deployed");
        expect(deployment.serverType).toBe("connect");
        expect(deployment.id).toBe("content-id-123");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.getDeployment("my-deployment", "/workspace");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("createDeployment (POST /deployments)", () => {
    describe("request correctness", () => {
      it("sends POST to /deployments", async () => {
        const client = getClient();
        await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");

        const requests = await getMockRequests("/deployments");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("POST");
        expect(requests[0].path).toBe("/deployments");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("sends account, config, and saveName in body", async () => {
        const client = getClient();
        await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");

        const requests = await getMockRequests("/deployments");
        const body = JSON.parse(requests[0].body!);
        expect(body.account).toBe("my-account");
        expect(body.config).toBe("my-config");
        expect(body.saveName).toBe("new-deployment");
      });

      it("sends Content-Type application/json header", async () => {
        const client = getClient();
        await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].headers["content-type"]).toContain("application/json");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");
        expect(result.status).toBe("success");
      });

      it("returns the created deployment", async () => {
        const client = getClient();
        const result = await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");

        const deployment = result.result as any;
        expect(deployment.deploymentName).toBe("new-deployment");
        expect(deployment.state).toBe("new");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.createDeployment("/workspace", "my-account", "my-config", "new-deployment");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("deleteDeployment (DELETE /deployments/:name)", () => {
    describe("request correctness", () => {
      it("sends DELETE to /deployments/:name", async () => {
        const client = getClient();
        await client.deleteDeployment("my-deployment", "/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("DELETE");
        expect(requests[0].path).toBe("/deployments/my-deployment");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.deleteDeployment("my-deployment", "/workspace");

        const requests = await getMockRequests("/deployments");
        expect(requests[0].query.dir).toBe("/workspace");
      });
    });

    describe("response parsing", () => {
      it("returns success status for 204 response", async () => {
        const client = getClient();
        const result = await client.deleteDeployment("my-deployment", "/workspace");
        expect(result.status).toBe("success");
      });
    });
  });

  describe("patchDeployment (PATCH /deployments/:name)", () => {
    describe("request correctness", () => {
      it("sends PATCH to /deployments/:name", async () => {
        const client = getClient();
        await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });

        const requests = await getMockRequests("/deployments");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("PATCH");
        expect(requests[0].path).toBe("/deployments/my-deployment");
      });

      it("sends dir as query parameter", async () => {
        const client = getClient();
        await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });

        const requests = await getMockRequests("/deployments");
        expect(requests[0].query.dir).toBe("/workspace");
      });

      it("sends configurationName and id in body (matching extension mapping)", async () => {
        const client = getClient();
        await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
          guid: "new-guid-456",
        });

        const requests = await getMockRequests("/deployments");
        const body = JSON.parse(requests[0].body!);
        expect(body.configurationName).toBe("updated-config");
        expect(body.id).toBe("new-guid-456");
      });

      it("sends Content-Type application/json header", async () => {
        const client = getClient();
        await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });

        const requests = await getMockRequests("/deployments");
        expect(requests[0].headers["content-type"]).toContain("application/json");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });
        expect(result.status).toBe("success");
      });

      it("returns the patched deployment", async () => {
        const client = getClient();
        const result = await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });

        const deployment = result.result as any;
        expect(deployment.configurationName).toBe("updated-config");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.patchDeployment("my-deployment", "/workspace", {
          configName: "updated-config",
        });
        expect(result.result).toMatchSnapshot();
      });
    });
  });
});
