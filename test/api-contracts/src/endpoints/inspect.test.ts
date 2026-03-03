import { describe, it, expect } from "vitest";
import { getClient } from "../helpers";

const client = getClient();

describe("POST /api/inspect (per-directory)", () => {
  it("inspects fastapi-simple/ — detects python-fastapi", async () => {
    const res = await client.postInspect({ dir: "fastapi-simple" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    expect(first.configuration.type).toBe("python-fastapi");
    expect(first.configuration.entrypoint).toMatch(/\.py$/);

    expect(body).toMatchSnapshot();
  });

  it("inspects static/ — detects html", async () => {
    const res = await client.postInspect({ dir: "static" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    expect(first.configuration.type).toBe("html");
    expect(first.configuration.entrypoint).toBe("index.html");

    expect(body).toMatchSnapshot();
  });

  it("inspects quarto-doc/ — detects quarto content", async () => {
    const res = await client.postInspect({ dir: "quarto-doc" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    expect(String(first.configuration.type)).toMatch(/quarto/);
    expect(first.configuration.entrypoint).toBe("index.qmd");

    expect(body).toMatchSnapshot();
  });

  it("inspects jupyter-nb/ — detects as quarto-static (Quarto inspects .ipynb)", async () => {
    const res = await client.postInspect({ dir: "jupyter-nb" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    // Go inspector routes .ipynb through Quarto, which classifies it as quarto-static
    expect(first.configuration.type).toBe("quarto-static");
    expect(String(first.configuration.entrypoint)).toMatch(/\.ipynb$/);

    expect(body).toMatchSnapshot();
  });

  it("inspects shiny-python/ — detects python-shiny", async () => {
    const res = await client.postInspect({ dir: "shiny-python" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    expect(first.configuration.type).toBe("python-shiny");
    expect(first.configuration.entrypoint).toBe("app.py");

    expect(body).toMatchSnapshot();
  });

  it("inspects rmd-static/ — detects as quarto-static (Quarto inspects .Rmd)", async () => {
    const res = await client.postInspect({ dir: "rmd-static" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const first = body[0];
    expect(first).toHaveProperty("projectDir");
    expect(first).toHaveProperty("configuration");
    // Go inspector routes .Rmd through Quarto, which classifies it as quarto-static
    expect(first.configuration.type).toBe("quarto-static");
    expect(String(first.configuration.entrypoint)).toMatch(/\.Rmd$/);

    expect(body).toMatchSnapshot();
  });
});

describe("POST /api/inspect (recursive)", () => {
  it("inspects root workspace recursively — returns multiple content types", async () => {
    const res = await client.postInspect({ recursive: "true" });
    expect(res.status).toBe("ok");

    const body = res.body as any[];
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThanOrEqual(4);

    const types = body.map((item: any) => item.configuration?.type);

    expect(types).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/python-fastapi/),
        expect.stringMatching(/html/),
        expect.stringMatching(/quarto/),
      ]),
    );

    expect(body).toMatchSnapshot();
  });
});

describe("POST /api/inspect (edge cases)", () => {
  it("returns not_found for a nonexistent directory", async () => {
    const res = await client.postInspect({ dir: "nonexistent-empty" });
    expect(res.status).toBe("not_found");
  });
});
