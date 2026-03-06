import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("GET /api/interpreters", () => {
  it("returns interpreter information", async () => {
    const res = await client.getInterpreters();
    expect(res.status).toBe("ok");

    const body = res.body as any;
    // The response should have python and/or r keys
    // Depending on machine environment, one or both may be present
    expect(body).toBeDefined();

    if (body.python) {
      expect(body.python).toHaveProperty("version");
      expect(body.python).toHaveProperty("packageManager");
    }

    if (body.r) {
      expect(body.r).toHaveProperty("version");
      expect(body.r).toHaveProperty("packageManager");
    }

    // Snapshot with flexible matching for version-dependent fields
    const matcher: Record<string, unknown> = {};
    if (body.python) {
      matcher.python = expect.objectContaining({
        version: expect.any(String),
        packageManager: expect.any(String),
      });
    }
    if (body.preferredPythonPath !== undefined) {
      matcher.preferredPythonPath = expect.any(String);
    }
    if (body.r) {
      matcher.r = expect.objectContaining({
        version: expect.any(String),
        packageManager: expect.any(String),
      });
    }
    if (body.preferredRPath !== undefined) {
      matcher.preferredRPath = expect.any(String);
    }
    expect(body).toMatchSnapshot(matcher);
  });
});
