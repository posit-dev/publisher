import { describe, it, expect, afterAll } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("Accounts", () => {
  let credGuid: string | null = null;

  afterAll(async () => {
    // Clean up the credential created by this test
    if (credGuid) {
      await client.deleteCredential(credGuid);
      credGuid = null;
    }
  });

  it("GET /api/accounts returns accounts array", async () => {
    const res = await client.getAccounts();
    expect(res.status).toBe("ok");
    expect(res.body).toBeInstanceOf(Array);
  });

  it("GET /api/accounts/{name} returns a single account after credential creation", async () => {
    const credRes = await client.postCredential({
      name: "accounts-test-server",
      url: "https://accounts-test.example.com",
      serverType: "connect",
      apiKey: "accounts-test-key",
    });
    expect(credRes.status).toBe("created");
    credGuid = (credRes.body as any).guid;

    const res = await client.getAccount("accounts-test-server");
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.name).toBe("accounts-test-server");
    expect(body.url).toBe("https://accounts-test.example.com");
    expect(body.type).toBe("connect");
    expect(body).toMatchSnapshot({
      type: expect.any(String),
      source: expect.any(String),
      authType: expect.any(String),
      name: expect.any(String),
      url: expect.any(String),
      insecure: expect.any(Boolean),
      caCert: expect.any(String),
      accountName: expect.any(String),
    });
  });

  it("GET /api/accounts includes the created account in the list", async () => {
    // This test depends on the credential created in the previous test
    const res = await client.getAccounts();
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body.length).toBeGreaterThan(0);

    const account = body.find(
      (a: any) => a.name === "accounts-test-server",
    );
    expect(account).toBeDefined();
  });

  it("GET /api/accounts/{name} returns 404 for non-existent account", async () => {
    const res = await client.getAccount("nonexistent-account");
    expect(res.status).toBe("not_found");
  });
});
