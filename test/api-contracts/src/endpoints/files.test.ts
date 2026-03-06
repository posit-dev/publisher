import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("GET /api/files", () => {
  it("returns file tree for the workspace root", async () => {
    const res = await client.getFiles();
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("files");
    expect(body.isDir).toBe(true);

    // Should contain subdirectories from the fixture workspace
    const childNames = (body.files as any[]).map((f: any) => f.base);
    expect(childNames).toEqual(
      expect.arrayContaining(["fastapi-simple", "static"]),
    );
  });

  it("returns subtree for a specific subdirectory", async () => {
    const res = await client.getFiles({ pathname: "fastapi-simple" });
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("files");
    expect(body.isDir).toBe(true);
    expect(body.base).toBe("fastapi-simple");

    const childNames = (body.files as any[]).map((f: any) => f.base);
    expect(childNames).toEqual(
      expect.arrayContaining(["app.py", "requirements.txt"]),
    );
  });
});
