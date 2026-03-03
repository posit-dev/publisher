import { describe, it, expect, beforeEach } from "vitest";
import { getClient, clearMockRequests, getMockRequests } from "../helpers";

describe("Credentials", () => {
  beforeEach(async () => {
    await clearMockRequests();
  });

  describe("listCredentials (GET /credentials)", () => {
    describe("request correctness", () => {
      it("sends GET to /credentials", async () => {
        const client = getClient();
        await client.listCredentials();

        const requests = await getMockRequests("/credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/credentials");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.listCredentials();
        expect(result.status).toBe("success");
      });

      it("returns array of credentials", async () => {
        const client = getClient();
        const result = await client.listCredentials();
        expect(result.result).toBeInstanceOf(Array);

        const creds = result.result as any[];
        expect(creds.length).toBeGreaterThan(0);
      });

      it("parses credential fields", async () => {
        const client = getClient();
        const result = await client.listCredentials();

        const creds = result.result as any[];
        const first = creds[0];
        expect(first.guid).toBe("abc-123-def-456");
        expect(first.name).toBe("my-connect-server");
        expect(first.url).toBe("https://connect.example.com");
        expect(first.serverType).toBe("connect");
        expect(first.apiKey).toBe("test-api-key-12345");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.listCredentials();
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("createCredential (POST /credentials)", () => {
    const newCred = {
      name: "new-server",
      url: "https://new-server.example.com",
      apiKey: "new-api-key",
      serverType: "connect",
    };

    describe("request correctness", () => {
      it("sends POST to /credentials", async () => {
        const client = getClient();
        await client.createCredential(newCred);

        const requests = await getMockRequests("/credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("POST");
        expect(requests[0].path).toBe("/credentials");
      });

      it("sends credential data as JSON body", async () => {
        const client = getClient();
        await client.createCredential(newCred);

        const requests = await getMockRequests("/credentials");
        expect(requests[0].body).not.toBeNull();
        const body = JSON.parse(requests[0].body!);
        expect(body.name).toBe("new-server");
        expect(body.url).toBe("https://new-server.example.com");
        expect(body.apiKey).toBe("new-api-key");
      });

      it("sends Content-Type application/json header", async () => {
        const client = getClient();
        await client.createCredential(newCred);

        const requests = await getMockRequests("/credentials");
        expect(requests[0].headers["content-type"]).toContain("application/json");
      });
    });

    describe("response parsing", () => {
      it("returns success status for 201 response", async () => {
        const client = getClient();
        const result = await client.createCredential(newCred);
        expect(result.status).toBe("success");
      });

      it("returns the created credential", async () => {
        const client = getClient();
        const result = await client.createCredential(newCred);

        const cred = result.result as any;
        expect(cred.guid).toBeDefined();
        expect(cred.name).toBe("new-server");
        expect(cred.url).toBe("https://new-server.example.com");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.createCredential(newCred);
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("getCredential (GET /credentials/:guid)", () => {
    describe("request correctness", () => {
      it("sends GET to /credentials/:guid", async () => {
        const client = getClient();
        await client.getCredential("abc-123-def-456");

        const requests = await getMockRequests("/credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].path).toBe("/credentials/abc-123-def-456");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.getCredential("abc-123-def-456");
        expect(result.status).toBe("success");
      });

      it("returns a single credential", async () => {
        const client = getClient();
        const result = await client.getCredential("abc-123-def-456");

        const cred = result.result as any;
        expect(cred.guid).toBe("abc-123-def-456");
        expect(cred.name).toBe("my-connect-server");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.getCredential("abc-123-def-456");
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("deleteCredential (DELETE /credentials/:guid)", () => {
    describe("request correctness", () => {
      it("sends DELETE to /credentials/:guid", async () => {
        const client = getClient();
        await client.deleteCredential("abc-123-def-456");

        const requests = await getMockRequests("/credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("DELETE");
        expect(requests[0].path).toBe("/credentials/abc-123-def-456");
      });
    });

    describe("response parsing", () => {
      it("returns success status for 204 response", async () => {
        const client = getClient();
        const result = await client.deleteCredential("abc-123-def-456");
        expect(result.status).toBe("success");
      });
    });
  });

  describe("resetCredentials (DELETE /credentials)", () => {
    describe("request correctness", () => {
      it("sends DELETE to /credentials (no guid)", async () => {
        const client = getClient();
        await client.resetCredentials();

        const requests = await getMockRequests("/credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("DELETE");
        expect(requests[0].path).toBe("/credentials");
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.resetCredentials();
        expect(result.status).toBe("success");
      });

      it("returns backup file path", async () => {
        const client = getClient();
        const result = await client.resetCredentials();

        const body = result.result as any;
        expect(body.backupFile).toBeDefined();
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.resetCredentials();
        expect(result.result).toMatchSnapshot();
      });
    });
  });

  describe("testCredentials (POST /test-credentials)", () => {
    describe("request correctness", () => {
      it("sends POST to /test-credentials", async () => {
        const client = getClient();
        await client.testCredentials("https://connect.example.com", false, "test-key");

        const requests = await getMockRequests("/test-credentials");
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("POST");
        expect(requests[0].path).toBe("/test-credentials");
      });

      it("sends url, insecure, and apiKey in body", async () => {
        const client = getClient();
        await client.testCredentials("https://connect.example.com", false, "test-key");

        const requests = await getMockRequests("/test-credentials");
        const body = JSON.parse(requests[0].body!);
        expect(body.url).toBe("https://connect.example.com");
        expect(body.insecure).toBe(false);
        expect(body.apiKey).toBe("test-key");
      });

      it("sends url and insecure without apiKey when not provided", async () => {
        const client = getClient();
        await client.testCredentials("https://connect.example.com", true);

        const requests = await getMockRequests("/test-credentials");
        const body = JSON.parse(requests[0].body!);
        expect(body.url).toBe("https://connect.example.com");
        expect(body.insecure).toBe(true);
      });
    });

    describe("response parsing", () => {
      it("returns success status", async () => {
        const client = getClient();
        const result = await client.testCredentials("https://connect.example.com", false, "test-key");
        expect(result.status).toBe("success");
      });

      it("parses user fields from test result", async () => {
        const client = getClient();
        const result = await client.testCredentials("https://connect.example.com", false, "test-key");

        const body = result.result as any;
        expect(body.user).toBeDefined();
        expect(body.user.username).toBe("bob");
        expect(body.error).toBeNull();
        expect(body.serverType).toBe("connect");
      });
    });

    describe("snapshot", () => {
      it("matches expected response shape", async () => {
        const client = getClient();
        const result = await client.testCredentials("https://connect.example.com", false, "test-key");
        expect(result.result).toMatchSnapshot();
      });
    });
  });
});
