// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { appModeFromType } from "./appMode";
import { manifestFromConfig } from "./manifestFromConfig";
import { ContentType, ConfigurationDetails } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";

function minimalConfig(
  overrides: Partial<ConfigurationDetails> = {},
): ConfigurationDetails {
  return {
    $schema: "" as ConfigurationDetails["$schema"],
    productType: ProductType.CONNECT,
    type: ContentType.PYTHON_DASH,
    validate: true,
    ...overrides,
  };
}

describe("appModeFromType", () => {
  it.each([
    [ContentType.HTML, "static"],
    [ContentType.JUPYTER_NOTEBOOK, "jupyter-static"],
    [ContentType.JUPYTER_VOILA, "jupyter-voila"],
    [ContentType.PYTHON_BOKEH, "python-bokeh"],
    [ContentType.PYTHON_DASH, "python-dash"],
    [ContentType.PYTHON_FASTAPI, "python-fastapi"],
    [ContentType.PYTHON_FLASK, "python-api"],
    [ContentType.PYTHON_SHINY, "python-shiny"],
    [ContentType.PYTHON_STREAMLIT, "python-streamlit"],
    [ContentType.PYTHON_GRADIO, "python-gradio"],
    [ContentType.PYTHON_PANEL, "python-panel"],
    [ContentType.QUARTO_SHINY, "quarto-shiny"],
    [ContentType.QUARTO, "quarto-static"],
    [ContentType.QUARTO_STATIC, "quarto-static"],
    [ContentType.R_PLUMBER, "api"],
    [ContentType.R_SHINY, "shiny"],
    [ContentType.RMD_SHINY, "rmd-shiny"],
    [ContentType.RMD, "rmd-static"],
  ])("maps %s → %s", (input, expected) => {
    expect(appModeFromType(input)).toBe(expected);
  });

  it("passes through unknown types as-is", () => {
    expect(appModeFromType("some-future-type")).toBe("some-future-type");
  });

  it("passes through ContentType.UNKNOWN as 'unknown'", () => {
    expect(appModeFromType(ContentType.UNKNOWN)).toBe("unknown");
  });
});

describe("manifestFromConfig", () => {
  it("creates a minimal manifest with correct version and appmode", () => {
    const m = manifestFromConfig(minimalConfig());
    expect(m.version).toBe(1);
    expect(m.metadata.appmode).toBe("python-dash");
    expect(m.packages).toEqual({});
    expect(m.files).toEqual({});
  });

  it("sets entrypoint in metadata", () => {
    const m = manifestFromConfig(minimalConfig({ entrypoint: "app.py" }));
    expect(m.metadata.entrypoint).toBe("app.py");
  });

  it("does not set optional sections when absent", () => {
    const m = manifestFromConfig(minimalConfig());
    expect(m.python).toBeUndefined();
    expect(m.jupyter).toBeUndefined();
    expect(m.quarto).toBeUndefined();
    expect(m.environment).toBeUndefined();
    expect(m.platform).toBeUndefined();
    expect(m.integration_requests).toBeUndefined();
  });

  describe("Python section", () => {
    it("sets python version and package manager for auto", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "auto",
          },
        }),
      );
      expect(m.python).toEqual({
        version: "3.11.4",
        package_manager: {
          name: "pip",
          package_file: "requirements.txt",
          allow_uv: undefined,
        },
      });
    });

    it("sets allow_uv=false for pip", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "pip",
          },
        }),
      );
      expect(m.python?.package_manager?.allow_uv).toBe(false);
      expect(m.python?.package_manager?.name).toBe("pip");
    });

    it("sets allow_uv=true for uv", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "uv",
          },
        }),
      );
      expect(m.python?.package_manager?.allow_uv).toBe(true);
      expect(m.python?.package_manager?.name).toBe("uv");
    });

    it("sets name=none for none", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "none",
          },
        }),
      );
      expect(m.python?.package_manager?.name).toBe("none");
      expect(m.python?.package_manager?.package_file).toBe("requirements.txt");
      expect(m.python?.package_manager?.allow_uv).toBeUndefined();
    });

    it("sets null package_manager when packageManager is empty", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "",
          },
        }),
      );
      expect(m.python?.version).toBe("3.11.4");
      expect(m.python?.package_manager).toBeNull();
    });

    it("falls back to pip for unrecognized packageManager values", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "conda",
          },
        }),
      );
      expect(m.python?.package_manager?.name).toBe("pip");
      expect(m.python?.package_manager?.package_file).toBe("requirements.txt");
      expect(m.python?.package_manager?.allow_uv).toBeUndefined();
    });

    it("sets environment.python.requires when requiresPython is set", () => {
      const m = manifestFromConfig(
        minimalConfig({
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "auto",
            requiresPython: ">=3.8",
          },
        }),
      );
      expect(m.environment?.python).toEqual({ requires: ">=3.8" });
    });
  });

  describe("R section", () => {
    it("sets platform from R version", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.R_SHINY,
          r: {
            version: "4.3.1",
            packageFile: "renv.lock",
            packageManager: "renv",
          },
        }),
      );
      expect(m.platform).toBe("4.3.1");
    });

    it("sets environment.r.requires when requiresR is set", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.R_SHINY,
          r: {
            version: "4.3.1",
            packageFile: "renv.lock",
            packageManager: "renv",
            requiresR: ">=4.0",
          },
        }),
      );
      expect(m.environment?.r).toEqual({ requires: ">=4.0" });
    });
  });

  describe("Jupyter section", () => {
    it("copies jupyter hide flags", () => {
      const m = manifestFromConfig(
        minimalConfig({
          jupyter: {
            hideAllInput: true,
            hideTaggedInput: false,
          },
        }),
      );
      expect(m.jupyter).toEqual({
        hide_all_input: true,
        hide_tagged_input: false,
      });
    });

    it("defaults undefined hide flags to false", () => {
      const m = manifestFromConfig(minimalConfig({ jupyter: {} }));
      expect(m.jupyter).toEqual({
        hide_all_input: false,
        hide_tagged_input: false,
      });
    });
  });

  describe("Quarto section", () => {
    it("copies quarto version and engines", () => {
      const m = manifestFromConfig(
        minimalConfig({
          quarto: {
            version: "1.4.0",
            engines: ["jupyter", "knitr"],
          },
        }),
      );
      expect(m.quarto).toEqual({
        version: "1.4.0",
        engines: ["jupyter", "knitr"],
      });
    });

    it("defaults engines to empty array", () => {
      const m = manifestFromConfig(
        minimalConfig({ quarto: { version: "1.4.0" } }),
      );
      expect(m.quarto?.engines).toEqual([]);
    });
  });

  describe("primary_rmd and primary_html", () => {
    it("sets primary_rmd for RMD type", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.RMD,
          entrypoint: "report.Rmd",
        }),
      );
      expect(m.metadata.primary_rmd).toBe("report.Rmd");
      expect(m.metadata.primary_html).toBeUndefined();
    });

    it("sets primary_rmd for RMD_SHINY type", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.RMD_SHINY,
          entrypoint: "report.Rmd",
        }),
      );
      expect(m.metadata.primary_rmd).toBe("report.Rmd");
    });

    it("sets primary_html for HTML type", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.HTML,
          entrypoint: "index.html",
        }),
      );
      expect(m.metadata.primary_html).toBe("index.html");
      expect(m.metadata.primary_rmd).toBeUndefined();
    });

    it("does not set primary_rmd or primary_html for other types", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.PYTHON_DASH,
          entrypoint: "app.py",
        }),
      );
      expect(m.metadata.primary_rmd).toBeUndefined();
      expect(m.metadata.primary_html).toBeUndefined();
    });
  });

  describe("has_parameters", () => {
    it("sets has_parameters when true", () => {
      const m = manifestFromConfig(minimalConfig({ hasParameters: true }));
      expect(m.metadata.has_parameters).toBe(true);
    });

    it("leaves has_parameters undefined when not set", () => {
      const m = manifestFromConfig(minimalConfig());
      expect(m.metadata.has_parameters).toBeUndefined();
    });

    it("omits has_parameters when explicitly false", () => {
      const m = manifestFromConfig(minimalConfig({ hasParameters: false }));
      expect(m.metadata.has_parameters).toBeUndefined();
    });
  });

  describe("integration requests", () => {
    it("copies integration requests with field mapping", () => {
      const m = manifestFromConfig(
        minimalConfig({
          integrationRequests: [
            {
              guid: "abc-123",
              name: "my-oauth",
              description: "OAuth integration",
              authType: "oauth2",
              type: "oauth-integration",
              config: { client_id: "xyz" },
            },
          ],
        }),
      );
      expect(m.integration_requests).toEqual([
        {
          guid: "abc-123",
          name: "my-oauth",
          description: "OAuth integration",
          auth_type: "oauth2",
          type: "oauth-integration",
          config: { client_id: "xyz" },
        },
      ]);
    });

    it("does not set integration_requests when absent", () => {
      const m = manifestFromConfig(minimalConfig());
      expect(m.integration_requests).toBeUndefined();
    });
  });

  describe("combined R and Python environment", () => {
    it("sets both environment.r and environment.python", () => {
      const m = manifestFromConfig(
        minimalConfig({
          type: ContentType.QUARTO,
          python: {
            version: "3.11.4",
            packageFile: "requirements.txt",
            packageManager: "pip",
            requiresPython: ">=3.9",
          },
          r: {
            version: "4.3.1",
            packageFile: "renv.lock",
            packageManager: "renv",
            requiresR: ">=4.0",
          },
        }),
      );
      expect(m.environment?.python).toEqual({ requires: ">=3.9" });
      expect(m.environment?.r).toEqual({ requires: ">=4.0" });
    });
  });
});
