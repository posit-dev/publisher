import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("GET /api/credentials/{guid}", () => {
  it("returns a credential by GUID", async () => {
    // First create a credential
    const createRes = await client.postCredential({
      name: "guid-test-server",
      url: "https://guid-test.example.com",
      serverType: "connect",
      apiKey: "guid-test-key-12345",
    });
    expect(createRes.status).toBe("created");
    const createdGuid = (createRes.body as any).guid;

    // Fetch it by GUID
    const res = await client.getCredential(createdGuid);
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body.guid).toBe(createdGuid);
    expect(body.name).toBe("guid-test-server");
    expect(body.url).toBe("https://guid-test.example.com");
    expect(body).toMatchSnapshot({
      guid: expect.any(String),
      name: expect.any(String),
      url: expect.any(String),
      serverType: expect.any(String),
      apiKey: expect.any(String),
    });

    // Clean up immediately within the test
    await client.deleteCredential(createdGuid);
  });

  it("returns 404 for non-existent GUID", async () => {
    const res = await client.getCredential(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe("not_found");
  });
});
