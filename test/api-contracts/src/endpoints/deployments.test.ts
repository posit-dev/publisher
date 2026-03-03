import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  removeDeploymentFile,
} from "../helpers";

describe("GET /api/deployments", () => {
  it("returns deployments array with pre-seeded deployment", async () => {
    const res = await apiGet("/api/deployments");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(0);

    // Find our pre-seeded deployment
    const testDeployment = body.find(
      (d: any) => d.deploymentName === "test-deployment",
    );
    expect(testDeployment).toBeDefined();
    expect(testDeployment.state).toBe("deployed");
    expect(testDeployment.serverUrl).toBe("https://connect.example.com");
    expect(testDeployment).toMatchSnapshot({
      deploymentName: expect.any(String),
      deploymentPath: expect.any(String),
      projectDir: expect.any(String),
      configurationPath: expect.any(String),
      saveName: expect.any(String),
      state: "deployed",
      serverUrl: expect.any(String),
      serverType: "connect",
      id: expect.any(String),
      dashboardUrl: expect.any(String),
      directUrl: expect.any(String),
      logsUrl: expect.any(String),
      createdAt: expect.any(String),
      deployedAt: expect.any(String),
      bundleId: expect.any(String),
      configurationName: expect.any(String),
    });
  });

  it("returns empty array for directory with no deployments", async () => {
    const res = await apiGet("/api/deployments?dir=static");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe("GET /api/deployments/{name}", () => {
  it("returns a single deployment by name", async () => {
    const res = await apiGet("/api/deployments/test-deployment");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = await res.json();
    expect(body.deploymentName).toBe("test-deployment");
    expect(body.state).toBe("deployed");
    expect(body.serverType).toBe("connect");
  });

  it("returns 404 for non-existent deployment", async () => {
    const res = await apiGet("/api/deployments/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/deployments (create deployment record)", () => {
  const credName = "deploy-test-server";
  const deployName = "post-test-deployment";

  beforeAll(async () => {
    // Create a credential so we have an account to reference
    await apiPost("/api/credentials", {
      name: credName,
      url: "https://deploy-test.example.com",
      serverType: "connect",
      apiKey: "deploy-test-key",
    });
  });

  afterAll(async () => {
    removeDeploymentFile(deployName);
    // Clean up credential
    const creds = await (await apiGet("/api/credentials")).json();
    const cred = creds.find((c: any) => c.name === credName);
    if (cred) {
      await apiDelete(`/api/credentials/${cred.guid}`);
    }
  });

  it("creates a new deployment record", async () => {
    const res = await apiPost("/api/deployments", {
      account: credName,
      config: "test-config",
      saveName: deployName,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = await res.json();
    expect(body.deploymentName).toBe(deployName);
    expect(body.state).toBe("new");
    expect(body.configurationName).toBe("test-config");
    expect(body.serverUrl).toBe("https://deploy-test.example.com");
  });

  it("returns 409 when deployment already exists", async () => {
    const res = await apiPost("/api/deployments", {
      account: credName,
      config: "test-config",
      saveName: deployName,
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/deployments/{name}", () => {
  it("updates configuration name on existing deployment", async () => {
    const res = await apiPatch("/api/deployments/test-deployment", {
      configurationName: "test-config",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = await res.json();
    expect(body.configurationName).toBe("test-config");
  });

  it("returns 404 for non-existent deployment", async () => {
    const res = await apiPatch("/api/deployments/does-not-exist", {
      configurationName: "test-config",
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/deployments/{name}", () => {
  const deleteName = "delete-test-deployment";

  it("deletes an existing deployment", async () => {
    // First, create a credential and deployment to delete
    const credRes = await apiPost("/api/credentials", {
      name: "delete-deploy-server",
      url: "https://delete-deploy.example.com",
      serverType: "connect",
      apiKey: "delete-deploy-key",
    });
    const cred = await credRes.json();

    await apiPost("/api/deployments", {
      account: "delete-deploy-server",
      config: "test-config",
      saveName: deleteName,
    });

    // Verify it exists
    const getRes = await apiGet(`/api/deployments/${deleteName}`);
    expect(getRes.status).toBe(200);

    // Delete it
    const deleteRes = await apiDelete(`/api/deployments/${deleteName}`);
    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const afterRes = await apiGet(`/api/deployments/${deleteName}`);
    expect(afterRes.status).toBe(404);

    // Clean up credential
    await apiDelete(`/api/credentials/${cred.guid}`);
  });

  it("returns 404 when deleting non-existent deployment", async () => {
    const res = await apiDelete("/api/deployments/does-not-exist");
    expect(res.status).toBe(404);
  });
});
