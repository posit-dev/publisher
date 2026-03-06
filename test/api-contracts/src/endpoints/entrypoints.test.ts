import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("POST /api/entrypoints", () => {
  it("returns entrypoints for the root workspace", async () => {
    const res = await client.postEntrypoints();
    expect(res.status).toBe("ok");

    const body = res.body as string[];
    expect(body).toBeInstanceOf(Array);

    // Should include files from across the fixture subdirectories
    expect(body.some((e) => e.endsWith(".py"))).toBe(true);
    expect(body.some((e) => e.endsWith(".html"))).toBe(true);
    expect(body.some((e) => e.endsWith(".qmd"))).toBe(true);
    expect(body.some((e) => e.endsWith(".ipynb"))).toBe(true);
    expect(body.some((e) => e.endsWith(".Rmd"))).toBe(true);

    expect(body).toMatchSnapshot();
  });

  it("returns entrypoints for a specific subdirectory", async () => {
    const res = await client.postEntrypoints({ dir: "fastapi-simple" });
    expect(res.status).toBe("ok");

    const body = res.body as string[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.every((e) => e.endsWith(".py"))).toBe(true);

    expect(body).toMatchSnapshot();
  });
});
