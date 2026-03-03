import { describe, it, expect } from "vitest";
import { apiGet, apiPost, apiDelete } from "../helpers";

describe("GET /api/credentials", () => {
  it("returns credentials array (initially empty)", async () => {
    const res = await apiGet("/api/credentials");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
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

    const res = await apiPost("/api/credentials", newCred);
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json();
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
    const res = await apiGet("/api/credentials");
    expect(res.status).toBe(200);

    const body = await res.json();
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

    const res = await apiPost("/api/credentials", dupCred);
    expect(res.status).toBe(409);
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
    const createRes = await apiPost("/api/credentials", cred);
    expect(createRes.status).toBe(201);
    const { guid } = await createRes.json();

    // Delete it
    const deleteRes = await apiDelete(`/api/credentials/${guid}`);
    expect(deleteRes.status).toBe(204);

    // Verify it's gone from the list
    const listRes = await apiGet("/api/credentials");
    const list = await listRes.json();
    const found = list.find((c: any) => c.guid === guid);
    expect(found).toBeUndefined();
  });
});

describe("DELETE /api/credentials (reset)", () => {
  it("resets all credentials", async () => {
    // Ensure we have at least one credential
    const listBefore = await apiGet("/api/credentials");
    const before = await listBefore.json();
    if (before.length === 0) {
      await apiPost("/api/credentials", {
        name: "reset-test-server",
        url: "https://reset-test.example.com",
        serverType: "connect",
        apiKey: "reset-test-key",
      });
    }

    // Reset
    const res = await apiDelete("/api/credentials");
    expect(res.status).toBe(200);

    // Verify empty
    const listAfter = await apiGet("/api/credentials");
    const after = await listAfter.json();
    expect(after).toEqual([]);
  });
});
