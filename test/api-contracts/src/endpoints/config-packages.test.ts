import { describe, it, expect, afterAll } from "vitest";
import { getClient, seedConfigFile, removeConfigFile } from "../helpers";

const client = getClient();

describe("GET /api/configurations/{name}/packages/python", () => {
  it("returns Python requirements for a Python config", async () => {
    const res = await client.getConfigPythonPackages("test-config");
    expect(res.status).toBe("ok");

    const body = res.body as any;
    expect(body).toHaveProperty("requirements");
    expect(body.requirements).toBeInstanceOf(Array);
    expect(body.requirements.length).toBeGreaterThan(0);
    // test-config points to fastapi-simple which has fastapi and uvicorn
    expect(body.requirements).toEqual(
      expect.arrayContaining(["fastapi", "uvicorn"]),
    );
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.getConfigPythonPackages("nonexistent-config");
    expect(res.status).toBe("not_found");
  });
});

describe("GET /api/configurations/{name}/packages/r", () => {
  it("returns 409 conflict for a config with no R section", async () => {
    // test-config is a Python config with no R section
    const res = await client.getConfigRPackages("test-config");
    expect(res.status).toBe("conflict");
  });

  it("returns 404 for non-existent configuration", async () => {
    const res = await client.getConfigRPackages("nonexistent-config");
    expect(res.status).toBe("not_found");
  });

  describe("with an R configuration", () => {
    const rConfigName = "r-packages-test";

    afterAll(() => {
      removeConfigFile(rConfigName);
    });

    it("returns R packages from renv.lock", async () => {
      // Create a config with r-shiny type pointing to the rmd-static directory which has an renv.lock
      seedConfigFile(
        rConfigName,
        `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "r-shiny"
entrypoint = "rmd-static/report.Rmd"
files = [
    "rmd-static/report.Rmd",
    "rmd-static/renv.lock",
]

[r]
version = "4.3.1"
package_file = "rmd-static/renv.lock"
package_manager = "renv"
`,
      );

      const res = await client.getConfigRPackages(rConfigName);
      expect(res.status).toBe("ok");

      const body = res.body as any;
      // The Go Lockfile struct uses lowercase JSON keys
      expect(body).toHaveProperty("r");
      expect(body).toHaveProperty("packages");
    });
  });
});
