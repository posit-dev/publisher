import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("GET /api/credentials", () => {
  it("returns credentials array (initially empty)", async () => {
    const res = await client.getCredentials();
    expect(res.status).toBe("ok");

    expect(res.body).toBeInstanceOf(Array);
  });
});

describe("POST /api/credentials", () => {
  let createdGuid: string | null = null;

  it("creates a new Connect credential", async () => {
    const newCred = {
      name: "test-connect-server",
      url: "https://connect.example.com",
      serverType: "connect",
      apiKey: "test-api-key-12345",
    };

    const res = await client.postCredential(newCred);
    expect(res.status).toBe("created");

    const body = res.body as any;
    expect(body.guid).toBeDefined();
    expect(body.name).toBe("test-connect-server");
    expect(body.url).toBe("https://connect.example.com");
    expect(body.serverType).toBe("connect");
    expect(body.apiKey).toBe("test-api-key-12345");
    createdGuid = body.guid;

    expect(body).toMatchSnapshot({
      guid: expect.any(String),
      name: expect.any(String),
      url: expect.any(String),
      serverType: expect.any(String),
      apiKey: expect.any(String),
    });
  });

  it("credential appears in list after creation", async () => {
    const res = await client.getCredentials();
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    const found = body.find((c: any) => c.guid === createdGuid);
    expect(found).toBeDefined();
    expect(found.name).toBe("test-connect-server");
  });

  it("returns 409 for duplicate URL", async () => {
    const dupCred = {
      name: "duplicate-server",
      url: "https://connect.example.com",
      serverType: "connect",
      apiKey: "another-api-key",
    };

    const res = await client.postCredential(dupCred);
    expect(res.status).toBe("conflict");
  });
});

describe("DELETE /api/credentials/{guid}", () => {
  it("deletes a credential by GUID", async () => {
    // Create a credential to delete
    const cred = {
      name: "to-delete-server",
      url: "https://delete-me.example.com",
      serverType: "connect",
      apiKey: "delete-me-key",
    };
    const createRes = await client.postCredential(cred);
    expect(createRes.status).toBe("created");
    const { guid } = createRes.body as any;

    // Delete it
    const deleteRes = await client.deleteCredential(guid);
    expect(deleteRes.status).toBe("no_content");

    // Verify it's gone from the list
    const listRes = await client.getCredentials();
    const list = listRes.body as any[];
    const found = list.find((c: any) => c.guid === guid);
    expect(found).toBeUndefined();
  });
});

describe("DELETE /api/credentials (reset)", () => {
  it("resets all credentials", async () => {
    // Ensure we have at least one credential
    const listBefore = await client.getCredentials();
    const before = listBefore.body as any[];
    if (before.length === 0) {
      await client.postCredential({
        name: "reset-test-server",
        url: "https://reset-test.example.com",
        serverType: "connect",
        apiKey: "reset-test-key",
      });
    }

    // Reset
    const res = await client.resetCredentials();
    expect(res.status).toBe("ok");

    // Verify empty
    const listAfter = await client.getCredentials();
    const after = listAfter.body as any[];
    expect(after).toEqual([]);
  });
});
