// Copyright (C) 2026 by Posit Software, PBC.
//
// Integration tests for the inspection service pipeline.
//
// Unlike the unit tests (e.g. detectorRunner.test.ts, normalize.test.ts)
// which mock the filesystem and interpreters, these tests exercise the
// real code paths against:
//   - A real temporary filesystem (created with mkdtemp, cleaned up after)
//   - Real Python and R executables when available on the PATH
//
// Tests that require a specific interpreter use `test.skipIf(!available)` so
// the suite can run in any environment without failures.
//
// Run these tests with:
//   npx vitest run src/inspect/integration.test.ts
//

import { execFile } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { ContentType } from "src/api/types/configurations";

vi.mock("src/logging");
import { clearPythonVersionCache } from "src/interpreters/pythonInterpreter";
import { inspectProject } from "./index";
import { globDir } from "./helpers/globDir";

const execFileAsync = promisify(execFile);

/** Create a temp directory, pass it to `fn`, then clean up. */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-inspect-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Check if an executable is available on PATH. */
async function isExecutableAvailable(name: string): Promise<boolean> {
  try {
    await execFileAsync(name, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Helper: create a minimal Jupyter notebook JSON file. */
function makeNotebookJSON(codeCells: string[][]): string {
  return JSON.stringify({
    cells: codeCells.map((source) => ({
      cell_type: "code",
      source,
    })),
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  });
}

// ---------------------------------------------------------------------------
// globDir – verify glob matching against a real filesystem
// ---------------------------------------------------------------------------

describe("globDir (real filesystem)", () => {
  test("returns matching .py files sorted", () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, "b.py"), "# b", "utf-8");
      await writeFile(path.join(dir, "a.py"), "# a", "utf-8");
      await writeFile(path.join(dir, "readme.md"), "# readme", "utf-8");

      const result = await globDir(dir, "*.py");
      expect(result).toHaveLength(2);
      // Should be sorted and only .py files
      expect(result[0]).toContain("a.py");
      expect(result[1]).toContain("b.py");
    }));

  test("returns empty array for empty directory", () =>
    withTempDir(async (dir) => {
      const result = await globDir(dir, "*.py");
      expect(result).toEqual([]);
    }));

  test("returns empty array for nonexistent directory", async () => {
    const result = await globDir("/nonexistent-dir-12345", "*.py");
    expect(result).toEqual([]);
  });

  test("excludes directories from results", () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, "app.py"), "# app", "utf-8");
      await mkdir(path.join(dir, "tests"));

      // Even though "tests" exists, *.py should not match it
      const result = await globDir(dir, "*.py");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("app.py");
    }));

  test("matches .html files", () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, "index.html"), "<html></html>", "utf-8");
      await writeFile(path.join(dir, "app.py"), "# app", "utf-8");

      const result = await globDir(dir, "*.html");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("index.html");
    }));

  test("matches .ipynb files", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "notebook.ipynb"),
        makeNotebookJSON([["x = 1\n"]]),
        "utf-8",
      );
      await writeFile(path.join(dir, "app.py"), "# app", "utf-8");

      const result = await globDir(dir, "*.ipynb");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("notebook.ipynb");
    }));
});

// ---------------------------------------------------------------------------
// inspectProject (non-recursive) – full pipeline against real files
// ---------------------------------------------------------------------------

describe(
  "inspectProject single-dir (real filesystem)",
  { timeout: 15_000 },
  () => {
    test("detects Flask project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\napp = Flask(__name__)\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        expect(flask?.configuration.entrypoint).toBe("app.py");
        expect(flask?.configuration.$schema).toContain(
          "posit-publishing-schema",
        );
        expect(flask?.configuration.validate).toBe(true);
        expect(flask?.projectDir).toBe(".");
      }));

    test("detects FastAPI project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "main.py"),
          "from fastapi import FastAPI\napp = FastAPI()\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const fastapi = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FASTAPI,
        );
        expect(fastapi).toBeDefined();
        expect(fastapi?.configuration.entrypoint).toBe("main.py");
        expect(fastapi?.projectDir).toBe(".");
      }));

    test("detects Dash project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "import dash\napp = dash.Dash(__name__)\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const dashApp = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_DASH,
        );
        expect(dashApp).toBeDefined();
        expect(dashApp?.configuration.entrypoint).toBe("app.py");
      }));

    test("detects Streamlit project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "streamlit_app.py"),
          "import streamlit as st\nst.title('Hello')\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const streamlit = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_STREAMLIT,
        );
        expect(streamlit).toBeDefined();
        expect(streamlit?.configuration.entrypoint).toBe("streamlit_app.py");
      }));

    test("detects Bokeh project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from bokeh.plotting import figure\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const bokeh = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_BOKEH,
        );
        expect(bokeh).toBeDefined();
        expect(bokeh?.configuration.entrypoint).toBe("app.py");
      }));

    test("detects Gradio project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "import gradio as gr\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const gradio = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_GRADIO,
        );
        expect(gradio).toBeDefined();
        expect(gradio?.configuration.entrypoint).toBe("app.py");
      }));

    test("detects Panel project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "import panel as pn\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const panel = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_PANEL,
        );
        expect(panel).toBeDefined();
        expect(panel?.configuration.entrypoint).toBe("app.py");
      }));

    test("detects R Shiny project with app.R", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.R"),
          "library(shiny)\nshinyApp(ui, server)\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.R_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.configuration.entrypoint).toBe("app.R");
        expect(shiny?.projectDir).toBe(".");
      }));

    test("detects R Shiny project with server.R", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "server.R"),
          "library(shiny)\nfunction(input, output) {}\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.R_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.configuration.entrypoint).toBe("server.R");
      }));

    test("detects Jupyter notebook", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "analysis.ipynb"),
          makeNotebookJSON([
            ["import pandas as pd\n", "df = pd.DataFrame()\n"],
          ]),
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const notebook = results.find(
          (r) => r.configuration.type === ContentType.JUPYTER_NOTEBOOK,
        );
        expect(notebook).toBeDefined();
        expect(notebook?.configuration.entrypoint).toBe("analysis.ipynb");
      }));

    test("detects Voila notebook with ipywidgets", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "dashboard.ipynb"),
          makeNotebookJSON([
            ["import ipywidgets\n", "w = ipywidgets.IntSlider()\n"],
          ]),
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const voila = results.find(
          (r) => r.configuration.type === ContentType.JUPYTER_VOILA,
        );
        expect(voila).toBeDefined();
        expect(voila?.configuration.entrypoint).toBe("dashboard.ipynb");
      }));

    test("detects static HTML project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "index.html"),
          "<html><body>Hello</body></html>",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        expect(html?.configuration.entrypoint).toBe("index.html");
        expect(html?.configuration.files).toContain("/index.html");
      }));

    test("detects HTML with _site companion directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "index.html"),
          "<html><body>Hello</body></html>",
          "utf-8",
        );
        await mkdir(path.join(dir, "_site"));

        const results = await inspectProject({ projectDir: dir });

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        expect(html?.configuration.files).toContain("/index.html");
        expect(html?.configuration.files).toContain("/_site");
      }));

    test("detects HTML with stem_files companion directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "report.html"),
          "<html><body>Report</body></html>",
          "utf-8",
        );
        await mkdir(path.join(dir, "report_files"));

        const results = await inspectProject({ projectDir: dir });

        const html = results.find(
          (r) =>
            r.configuration.type === ContentType.HTML &&
            r.configuration.entrypoint === "report.html",
        );
        expect(html).toBeDefined();
        expect(html?.configuration.files).toContain("/report_files");
      }));

    test("detects Python Shiny app", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from shiny import App, ui\napp = App(ui.page_fluid(), None)\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.configuration.entrypoint).toBe("app.py");
      }));

    test("detects Python Shiny Express with entrypointObjectRef", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from shiny.express import ui\nui.h1('Hello')\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.configuration.entrypointObjectRef).toBe(
          "shiny.express.app:app_2e_py",
        );
      }));

    test("returns unknown config for empty project", () =>
      withTempDir(async (dir) => {
        const results = await inspectProject({ projectDir: dir });

        expect(results).toHaveLength(1);
        expect(results[0]?.configuration.type).toBe(ContentType.UNKNOWN);
        expect(results[0]?.projectDir).toBe(".");
      }));

    test("detects multiple content types in same project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\napp = Flask(__name__)\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "index.html"),
          "<html><body>Hello</body></html>",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const types = results.map((r) => r.configuration.type);
        expect(types).toContain(ContentType.PYTHON_FLASK);
        expect(types).toContain(ContentType.HTML);
      }));

    // ----- Plumber -----

    test("detects Plumber project with plumber.R", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "plumber.R"),
          '# plumber API\n#* @get /echo\nfunction() { "hello" }\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const plumber = results.find(
          (r) => r.configuration.type === ContentType.R_PLUMBER,
        );
        expect(plumber).toBeDefined();
        expect(plumber?.configuration.entrypoint).toBe("plumber.R");
        expect(plumber?.projectDir).toBe(".");
      }));

    test("detects Plumber project with entrypoint.R", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "entrypoint.R"),
          '# plumber API\n#* @get /echo\nfunction() { "hello" }\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const plumber = results.find(
          (r) => r.configuration.type === ContentType.R_PLUMBER,
        );
        expect(plumber).toBeDefined();
        expect(plumber?.configuration.entrypoint).toBe("entrypoint.R");
      }));

    test("detects Plumber via _server.yml", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "_server.yml"),
          "engine: plumber\nroutes: api.R\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "api.R"),
          '# plumber routes\n#* @get /hello\nfunction() { "hi" }\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const plumber = results.find(
          (r) => r.configuration.type === ContentType.R_PLUMBER,
        );
        expect(plumber).toBeDefined();
        expect(plumber?.configuration.files).toContain("/_server.yml");
        expect(plumber?.configuration.files).toContain("/api.R");
      }));

    // ----- RMarkdown -----

    test("detects RMarkdown project", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "report.Rmd"),
          '---\ntitle: "My Report"\n---\n\n```{r}\nsummary(cars)\n```\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const rmd = results.find(
          (r) => r.configuration.type === ContentType.RMD,
        );
        expect(rmd).toBeDefined();
        expect(rmd?.configuration.entrypoint).toBe("report.Rmd");
        expect(rmd?.configuration.title).toBe("My Report");
      }));

    test("detects Shiny RMarkdown", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "report.Rmd"),
          '---\ntitle: "Shiny Doc"\nruntime: shiny\n---\n\n```{r}\nsliderInput("n", "N", 1, 100, 50)\n```\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const rmdShiny = results.find(
          (r) => r.configuration.type === ContentType.RMD_SHINY,
        );
        expect(rmdShiny).toBeDefined();
        expect(rmdShiny?.configuration.entrypoint).toBe("report.Rmd");
      }));

    test("detects parameterized RMarkdown", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "report.Rmd"),
          '---\ntitle: "Parameterized"\nparams:\n  year: 2024\n---\n\n```{r}\nparams$year\n```\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const rmd = results.find(
          (r) =>
            r.configuration.type === ContentType.RMD &&
            r.configuration.entrypoint === "report.Rmd",
        );
        expect(rmd).toBeDefined();
        expect(rmd?.configuration.hasParameters).toBe(true);
      }));

    test("detects RMarkdown site with _site.yml", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "_site.yml"),
          'name: "My Site"\noutput_dir: _site\n',
          "utf-8",
        );
        await writeFile(
          path.join(dir, "index.Rmd"),
          '---\ntitle: "Home"\n---\n\nWelcome\n',
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const rmd = results.find(
          (r) => r.configuration.type === ContentType.RMD,
        );
        expect(rmd).toBeDefined();
        expect(rmd?.configuration.files).toContain("/_site.yml");
      }));

    // ----- Quarto -----

    test("detects Quarto project (.qmd)", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "doc.qmd"),
          "---\ntitle: My Doc\n---\n\nHello world\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const quarto = results.find(
          (r) => r.configuration.type === ContentType.QUARTO_STATIC,
        );
        expect(quarto).toBeDefined();
        expect(quarto?.configuration.entrypoint).toBe("doc.qmd");
      }));

    test("filters to specific entrypoint", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "other.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          entrypoint: "app.py",
        });

        const flaskResults = results.filter(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flaskResults).toHaveLength(1);
        expect(flaskResults[0]?.configuration.entrypoint).toBe("app.py");
      }));

    test("skips empty notebooks", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "empty.ipynb"),
          JSON.stringify({
            cells: [],
            metadata: {},
            nbformat: 4,
            nbformat_minor: 5,
          }),
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        // No notebook should be detected, only unknown
        const notebooks = results.filter(
          (r) =>
            r.configuration.type === ContentType.JUPYTER_NOTEBOOK ||
            r.configuration.type === ContentType.JUPYTER_VOILA,
        );
        expect(notebooks).toHaveLength(0);
      }));

    test("skips invalid notebook JSON gracefully", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "broken.ipynb"),
          "not valid json",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const notebooks = results.filter(
          (r) =>
            r.configuration.type === ContentType.JUPYTER_NOTEBOOK ||
            r.configuration.type === ContentType.JUPYTER_VOILA,
        );
        expect(notebooks).toHaveLength(0);
      }));

    test("sorts preferred entrypoints first", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "zebra.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const flaskResults = results.filter(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flaskResults.length).toBeGreaterThanOrEqual(2);
        // "app" is a preferred name, should sort before "zebra"
        expect(flaskResults[0]?.configuration.entrypoint).toBe("app.py");
      }));

    test("sets title from directory basename", () =>
      withTempDir(async (dir) => {
        await writeFile(path.join(dir, "index.html"), "<html></html>", "utf-8");

        const results = await inspectProject({ projectDir: dir });

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        // Title should be the temp directory's basename
        expect(html?.configuration.title).toBe(path.basename(dir));
      }));
  },
);

// ---------------------------------------------------------------------------
// inspectProject recursive – walkDirectory, SKIP_DIRS, UNKNOWN filtering
// ---------------------------------------------------------------------------

describe(
  "inspectProject recursive (real filesystem)",
  { timeout: 15_000 },
  () => {
    test("detects content in subdirectories", () =>
      withTempDir(async (dir) => {
        const subDir = path.join(dir, "api");
        await mkdir(subDir);
        await writeFile(
          path.join(subDir, "main.py"),
          "from fastapi import FastAPI\napp = FastAPI()\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const fastapi = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FASTAPI,
        );
        expect(fastapi).toBeDefined();
        expect(fastapi?.projectDir).toBe("api");
      }));

    test("detects content in root and subdirectories", () =>
      withTempDir(async (dir) => {
        // Root Flask app
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        // Subdirectory HTML site
        const subDir = path.join(dir, "site");
        await mkdir(subDir);
        await writeFile(
          path.join(subDir, "index.html"),
          "<html></html>",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        expect(flask?.projectDir).toBe(".");

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        expect(html?.projectDir).toBe("site");
      }));

    test("skips node_modules directory", () =>
      withTempDir(async (dir) => {
        // Real content
        await writeFile(path.join(dir, "index.html"), "<html></html>", "utf-8");

        // Content inside node_modules should be ignored
        const nmDir = path.join(dir, "node_modules", "somepackage");
        await mkdir(nmDir, { recursive: true });
        await writeFile(
          path.join(nmDir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // Should NOT find Flask from node_modules
        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeUndefined();
      }));

    test("skips .git directory", () =>
      withTempDir(async (dir) => {
        await writeFile(path.join(dir, "index.html"), "<html></html>", "utf-8");

        const gitDir = path.join(dir, ".git", "hooks");
        await mkdir(gitDir, { recursive: true });
        await writeFile(
          path.join(gitDir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeUndefined();
      }));

    test("skips .venv directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const venvDir = path.join(dir, ".venv", "lib");
        await mkdir(venvDir, { recursive: true });
        await writeFile(
          path.join(venvDir, "main.py"),
          "from fastapi import FastAPI\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // Should find Flask from root but not FastAPI from .venv
        const fastapi = results.find(
          (r) =>
            r.configuration.type === ContentType.PYTHON_FASTAPI &&
            r.projectDir !== ".",
        );
        expect(fastapi).toBeUndefined();
      }));

    test("skips __pycache__ directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const cacheDir = path.join(dir, "__pycache__");
        await mkdir(cacheDir);
        await writeFile(
          path.join(cacheDir, "app.py"),
          "from dash import Dash\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const dash = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_DASH,
        );
        expect(dash).toBeUndefined();
      }));

    test("skips renv directory", () =>
      withTempDir(async (dir) => {
        await writeFile(path.join(dir, "app.R"), "library(shiny)\n", "utf-8");

        const renvDir = path.join(dir, "renv", "lib");
        await mkdir(renvDir, { recursive: true });
        await writeFile(
          path.join(renvDir, "index.html"),
          "<html></html>",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // Should NOT find HTML from renv directory
        const htmlInRenv = results.find(
          (r) =>
            r.configuration.type === ContentType.HTML && r.projectDir !== ".",
        );
        expect(htmlInRenv).toBeUndefined();
      }));

    test("skips .posit directory", () =>
      withTempDir(async (dir) => {
        await writeFile(path.join(dir, "index.html"), "<html></html>", "utf-8");

        const positDir = path.join(dir, ".posit", "publish");
        await mkdir(positDir, { recursive: true });
        await writeFile(
          path.join(positDir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeUndefined();
      }));

    test("skips env directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const envDir = path.join(dir, "env", "lib");
        await mkdir(envDir, { recursive: true });
        await writeFile(
          path.join(envDir, "main.py"),
          "from fastapi import FastAPI\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // Should find Flask from root but not FastAPI from env
        const fastapi = results.find(
          (r) =>
            r.configuration.type === ContentType.PYTHON_FASTAPI &&
            r.projectDir !== ".",
        );
        expect(fastapi).toBeUndefined();
      }));

    test("skips venv directory", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const venvDir = path.join(dir, "venv", "lib");
        await mkdir(venvDir, { recursive: true });
        await writeFile(
          path.join(venvDir, "main.py"),
          "from fastapi import FastAPI\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // Should find Flask from root but not FastAPI from venv
        const fastapi = results.find(
          (r) =>
            r.configuration.type === ContentType.PYTHON_FASTAPI &&
            r.projectDir !== ".",
        );
        expect(fastapi).toBeUndefined();
      }));

    test("filters UNKNOWN configs from subdirectories", () =>
      withTempDir(async (dir) => {
        // Root has Flask app
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        // Empty subdirectory - would produce UNKNOWN
        await mkdir(path.join(dir, "emptysubdir"));

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        // UNKNOWN configs should be filtered out in recursive mode
        const unknowns = results.filter(
          (r) => r.configuration.type === ContentType.UNKNOWN,
        );
        expect(unknowns).toHaveLength(0);
      }));

    test("handles multiple subdirectories with different content types", () =>
      withTempDir(async (dir) => {
        // Flask in api/
        const apiDir = path.join(dir, "api");
        await mkdir(apiDir);
        await writeFile(
          path.join(apiDir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        // R Shiny in dashboard/
        const dashDir = path.join(dir, "dashboard");
        await mkdir(dashDir);
        await writeFile(
          path.join(dashDir, "app.R"),
          "library(shiny)\n",
          "utf-8",
        );

        // HTML in docs/
        const docsDir = path.join(dir, "docs");
        await mkdir(docsDir);
        await writeFile(
          path.join(docsDir, "index.html"),
          "<html></html>",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        expect(flask?.projectDir).toBe("api");

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.R_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.projectDir).toBe("dashboard");

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        expect(html?.projectDir).toBe("docs");
      }));

    test("handles nested subdirectories", () =>
      withTempDir(async (dir) => {
        const nestedDir = path.join(dir, "projects", "myapp");
        await mkdir(nestedDir, { recursive: true });
        await writeFile(
          path.join(nestedDir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        // path.join uses OS separator, but projectDir should use forward slash
        expect(flask?.projectDir).toMatch(/projects[/\\]myapp/);
      }));

    test("sorts results across subdirectories", () =>
      withTempDir(async (dir) => {
        // Preferred name in subdirectory
        const subA = path.join(dir, "a-project");
        await mkdir(subA);
        await writeFile(
          path.join(subA, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        // Non-preferred name in another subdirectory
        const subB = path.join(dir, "b-project");
        await mkdir(subB);
        await writeFile(
          path.join(subB, "zebra.py"),
          "from flask import Flask\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        const flaskResults = results.filter(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flaskResults.length).toBeGreaterThanOrEqual(2);
        // "app.py" (preferred name) should sort before "zebra.py"
        expect(flaskResults[0]?.configuration.entrypoint).toBe("app.py");
      }));

    test("returns empty array when all subdirectories are empty", () =>
      withTempDir(async (dir) => {
        // Create subdirectories with no deployable content
        await mkdir(path.join(dir, "subdir1"));
        await mkdir(path.join(dir, "subdir2"));
        // No files in root or subdirs — every dir produces UNKNOWN which
        // gets filtered out in recursive mode

        const results = await inspectProject({
          projectDir: dir,
          recursive: true,
        });

        expect(results).toHaveLength(0);
      }));
  },
);

// ---------------------------------------------------------------------------
// inspectProject with real interpreters – normalization end-to-end
//
// These tests verify that the full pipeline (detection → normalization with
// real interpreter calls → final ConfigurationDetails) populates Python/R
// config fields correctly.
// ---------------------------------------------------------------------------

describe(
  "inspectProject with real interpreters (real filesystem)",
  { timeout: 15_000 },
  () => {
    let python3Available = false;
    let pythonAvailable = false;
    let pythonCmd = "python";
    let rAvailable = false;
    let quartoAvailable = false;

    beforeAll(async () => {
      python3Available = await isExecutableAvailable("python3");
      pythonAvailable =
        python3Available || (await isExecutableAvailable("python"));
      pythonCmd = python3Available ? "python3" : "python";
      rAvailable = await isExecutableAvailable("R");
      quartoAvailable = await isExecutableAvailable("quarto");
    });

    test("populates python config for Flask project", ({ skip }) => {
      if (!pythonAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\napp = Flask(__name__)\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "requirements.txt"),
          "flask>=2.0\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        expect(flask?.configuration.python).toBeDefined();
        // Version and packageFile are left as empty placeholders (determined at publish time)
        expect(flask?.configuration.python?.version).toBe("");
        expect(flask?.configuration.python?.packageFile).toBe("");
        expect(flask?.configuration.files).toContain("/requirements.txt");
      });
    });

    test("populates python requiresPython from .python-version", ({ skip }) => {
      if (!pythonAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        await writeFile(path.join(dir, ".python-version"), "3.11", "utf-8");

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        // Config uses empty placeholders; requiresPython is determined at publish time
        expect(flask?.configuration.python?.version).toBe("");
      });
    });

    test("populates R config for R Shiny project", ({ skip }) => {
      if (!rAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.R"),
          "library(shiny)\nshinyApp(ui, server)\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          rPath: "R",
        });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.R_SHINY,
        );
        expect(shiny).toBeDefined();
        expect(shiny?.configuration.r).toBeDefined();
        // Version is left as empty placeholder (determined at publish time)
        expect(shiny?.configuration.r?.version).toBe("");
      });
    });

    test("populates R requiresR from renv.lock", ({ skip }) => {
      if (!rAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(path.join(dir, "app.R"), "library(shiny)\n", "utf-8");
        await writeFile(
          path.join(dir, "renv.lock"),
          JSON.stringify({ R: { Version: "4.3.1" }, Packages: {} }),
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          rPath: "R",
        });

        const shiny = results.find(
          (r) => r.configuration.type === ContentType.R_SHINY,
        );
        // Config uses empty placeholders; requiresR is determined at publish time
        expect(shiny?.configuration.r?.version).toBe("");
      });
    });

    test("detects R via rpy2 dependency in Python project", ({ skip }) => {
      if (!pythonAvailable || !rAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\nimport rpy2\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "requirements.txt"),
          "flask>=2.0\nrpy2>=3.5\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
          rPath: "R",
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        // Python config should be populated (empty placeholders)
        expect(flask?.configuration.python).toBeDefined();
        expect(flask?.configuration.python?.version).toBe("");
        // R config should also be populated due to rpy2 (empty placeholders)
        expect(flask?.configuration.r).toBeDefined();
        expect(flask?.configuration.r?.version).toBe("");
      });
    });

    test("does not detect R for Python project without rpy2", ({ skip }) => {
      if (!pythonAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "app.py"),
          "from flask import Flask\n",
          "utf-8",
        );
        await writeFile(
          path.join(dir, "requirements.txt"),
          "flask>=2.0\npandas\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
        });

        const flask = results.find(
          (r) => r.configuration.type === ContentType.PYTHON_FLASK,
        );
        expect(flask).toBeDefined();
        expect(flask?.configuration.python).toBeDefined();
        // No rpy2, so R should not be detected
        expect(flask?.configuration.r).toBeUndefined();
      });
    });

    test("populates python config for Jupyter notebook", ({ skip }) => {
      if (!pythonAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "analysis.ipynb"),
          makeNotebookJSON([["import pandas as pd\n"]]),
          "utf-8",
        );
        await writeFile(
          path.join(dir, "requirements.txt"),
          "pandas\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
        });

        const notebook = results.find(
          (r) => r.configuration.type === ContentType.JUPYTER_NOTEBOOK,
        );
        expect(notebook).toBeDefined();
        expect(notebook?.configuration.python).toBeDefined();
        // Version and packageFile are left as empty placeholders (determined at publish time)
        expect(notebook?.configuration.python?.version).toBe("");
        expect(notebook?.configuration.python?.packageFile).toBe("");
      });
    });

    test("does not populate python or R for static HTML", () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "index.html"),
          "<html><body>Static</body></html>",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const html = results.find(
          (r) => r.configuration.type === ContentType.HTML,
        );
        expect(html).toBeDefined();
        expect(html?.configuration.python).toBeUndefined();
        // HTML type should not trigger renv.lock check
        expect(html?.configuration.r).toBeUndefined();
      }));

    test("populates R config for Plumber project", ({ skip }) => {
      if (!rAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "plumber.R"),
          '# plumber API\n#* @get /echo\nfunction() { "hello" }\n',
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          rPath: "R",
        });

        const plumber = results.find(
          (r) => r.configuration.type === ContentType.R_PLUMBER,
        );
        expect(plumber).toBeDefined();
        expect(plumber?.configuration.r).toBeDefined();
        expect(plumber?.configuration.r?.version).toBe("");
      });
    });

    test("populates R config for RMarkdown project", ({ skip }) => {
      if (!rAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "report.Rmd"),
          '---\ntitle: "My Report"\n---\n\n```{r}\nsummary(cars)\n```\n',
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          rPath: "R",
        });

        const rmd = results.find(
          (r) => r.configuration.type === ContentType.RMD,
        );
        expect(rmd).toBeDefined();
        expect(rmd?.configuration.r).toBeDefined();
        expect(rmd?.configuration.r?.version).toBe("");
      });
    });

    test("detects Quarto project (.qmd) with quarto available", ({ skip }) => {
      if (!quartoAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "doc.qmd"),
          "---\ntitle: Quarto Doc\n---\n\nHello world\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const quarto = results.find(
          (r) => r.configuration.type === ContentType.QUARTO_STATIC,
        );
        expect(quarto).toBeDefined();
        expect(quarto?.configuration.quarto?.version).toMatch(
          /^\d+\.\d+\.\d+$/,
        );
        expect(quarto?.configuration.title).toBe("Quarto Doc");
      });
    });

    test("detects Shiny Quarto", ({ skip }) => {
      if (!quartoAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "dashboard.qmd"),
          "---\ntitle: Dashboard\nserver: shiny\n---\n\n```{r}\nsliderInput('n', 'N', 1, 100, 50)\n```\n",
          "utf-8",
        );

        const results = await inspectProject({ projectDir: dir });

        const quartoShiny = results.find(
          (r) => r.configuration.type === ContentType.QUARTO_SHINY,
        );
        expect(quartoShiny).toBeDefined();
        expect(quartoShiny?.configuration.entrypoint).toBe("dashboard.qmd");
      });
    });

    test("populates R config for Quarto R project", ({ skip }) => {
      if (!rAvailable || !quartoAvailable) skip();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "doc.qmd"),
          "---\ntitle: R Quarto\n---\n\n```{r}\nsummary(cars)\n```\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          rPath: "R",
        });

        const quarto = results.find(
          (r) => r.configuration.type === ContentType.QUARTO_STATIC,
        );
        expect(quarto).toBeDefined();
        expect(quarto?.configuration.r).toBeDefined();
        expect(quarto?.configuration.r?.version).toBe("");
        expect(quarto?.configuration.quarto?.engines).toContain("knitr");
      });
    });

    test("populates Python config for Quarto Python project", ({ skip }) => {
      if (!pythonAvailable || !quartoAvailable) skip();
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "doc.qmd"),
          "---\ntitle: Python Quarto\n---\n\n```{python}\nimport os\nprint(os.name)\n```\n",
          "utf-8",
        );

        const results = await inspectProject({
          projectDir: dir,
          pythonPath: pythonCmd,
        });

        const quarto = results.find(
          (r) => r.configuration.type === ContentType.QUARTO_STATIC,
        );
        expect(quarto).toBeDefined();
        expect(quarto?.configuration.python).toBeDefined();
        expect(quarto?.configuration.python?.version).toBe("");
        expect(quarto?.configuration.quarto?.engines).toContain("jupyter");
      });
    });
  },
);
