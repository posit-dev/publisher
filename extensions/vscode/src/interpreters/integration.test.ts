// Copyright (C) 2026 by Posit Software, PBC.
//
// Integration tests for the interpreter detection pipeline.
//
// Unlike the unit tests (e.g. pythonRequires.test.ts, rInterpreter.test.ts)
// which mock the filesystem and child processes, these tests exercise the
// real code paths against:
//   - A real temporary filesystem (created with mkdtemp, cleaned up after)
//   - Real Python and R executables when available on the PATH
//
// Tests that require a specific interpreter use `test.skipIf(!available)` so
// the suite can run in any environment without failures. In CI, the
// interpreter-integration.yaml workflow installs known Python and R versions
// across a matrix of configurations to ensure full coverage.
//
// Run these tests with:
//   npx vitest run src/interpreters/integration.test.ts
//
// Or as part of the dedicated npm script:
//   npm run test-integration-interpreters

import { execFile } from "child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { readFileText, fileExistsAt } from "./fsUtils";
import { getPythonRequires } from "./pythonRequires";
import { getRRequires } from "./rRequires";
import { getInterpreterDefaults } from "./index";
import {
  detectPythonInterpreter,
  clearPythonVersionCache,
} from "./pythonInterpreter";
import { detectRInterpreter } from "./rInterpreter";
import { scanRPackages, getRPackages } from "./rPackages";
import {
  scanPythonDependencies,
  runPythonScanScript,
} from "./scanPythonDependencies";

const execFileAsync = promisify(execFile);

/** Create a temp directory, pass it to `fn`, then clean up. */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Check if an executable is available on PATH by attempting to run it.
 * Used to determine whether interpreter-dependent tests should be skipped.
 */
async function isExecutableAvailable(name: string): Promise<boolean> {
  try {
    await execFileAsync(name, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the renv R package is installed by attempting to load it.
 * Used to determine whether scanRPackages tests should be skipped.
 */
async function isRenvAvailable(): Promise<boolean> {
  try {
    await execFileAsync("Rscript", ["-e", "library(renv)"]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// fsUtils – verify basic file I/O helpers against real disk
// ---------------------------------------------------------------------------

describe("fsUtils (real filesystem)", () => {
  test("readFileText reads an existing file", () =>
    withTempDir(async (dir) => {
      const filePath = path.join(dir, "hello.txt");
      await writeFile(filePath, "hello world", "utf-8");
      const result = await readFileText(filePath);
      expect(result).toBe("hello world");
    }));

  test("readFileText returns null for a missing file", () =>
    withTempDir(async (dir) => {
      const result = await readFileText(path.join(dir, "nonexistent.txt"));
      expect(result).toBeNull();
    }));

  test("fileExistsAt returns true for an existing file", () =>
    withTempDir(async (dir) => {
      const filePath = path.join(dir, "exists.txt");
      await writeFile(filePath, "", "utf-8");
      expect(await fileExistsAt(filePath)).toBe(true);
    }));

  test("fileExistsAt returns false for a missing file", () =>
    withTempDir(async (dir) => {
      expect(await fileExistsAt(path.join(dir, "nope.txt"))).toBe(false);
    }));
});

// ---------------------------------------------------------------------------
// getPythonRequires – version constraint extraction from real files
// ---------------------------------------------------------------------------

describe("getPythonRequires (real filesystem)", () => {
  test("returns empty string when project has no python config files", () =>
    withTempDir(async (dir) => {
      expect(await getPythonRequires(dir)).toBe("");
    }));

  test("reads .python-version file", () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, ".python-version"), "3.11.4", "utf-8");
      const result = await getPythonRequires(dir);
      expect(result).toBe("~=3.11.0");
    }));

  test("reads requires-python from pyproject.toml", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "pyproject.toml"),
        '[project]\nrequires-python = ">=3.9"\n',
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe(">=3.9");
    }));

  test("reads python_requires from setup.cfg", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "setup.cfg"),
        "[options]\npython_requires = >=3.8\n",
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe(">=3.8");
    }));

  test(".python-version takes priority over pyproject.toml", () =>
    withTempDir(async (dir) => {
      await writeFile(path.join(dir, ".python-version"), "3.10", "utf-8");
      await writeFile(
        path.join(dir, "pyproject.toml"),
        '[project]\nrequires-python = ">=3.8"\n',
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe("~=3.10.0");
    }));
});

// ---------------------------------------------------------------------------
// getRRequires – R version constraint extraction from real files
// ---------------------------------------------------------------------------

describe("getRRequires (real filesystem)", () => {
  test("returns empty string when project has no R config files", () =>
    withTempDir(async (dir) => {
      expect(await getRRequires(dir)).toBe("");
    }));

  test("reads R version from DESCRIPTION Depends", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.1.0), utils\n",
        "utf-8",
      );
      expect(await getRRequires(dir)).toBe(">= 4.1.0");
    }));

  test("reads R version from renv.lock", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.3.1" } }),
        "utf-8",
      );
      expect(await getRRequires(dir)).toBe("~=4.3.0");
    }));

  test("DESCRIPTION takes priority over renv.lock", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.0.0)\n",
        "utf-8",
      );
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.3.1" } }),
        "utf-8",
      );
      expect(await getRRequires(dir)).toBe(">= 4.0.0");
    }));
});

// ---------------------------------------------------------------------------
// detectPythonInterpreter – runs a real Python executable to get its version,
// and checks for requirements.txt on disk. Tests are skipped when no Python
// interpreter is found on the PATH.
// ---------------------------------------------------------------------------

describe(
  "detectPythonInterpreter (real interpreter)",
  { timeout: 15_000 },
  async () => {
    // Probe for available Python executable; prefer "python3" (Unix convention)
    // and fall back to "python" (Windows / pyenv shim convention).
    const python3Available = await isExecutableAvailable("python3");
    const pythonAvailable =
      python3Available || (await isExecutableAvailable("python"));
    const pythonCmd = python3Available ? "python3" : "python";

    test.skipIf(!pythonAvailable)(
      "detects version from a real Python executable",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.config.packageManager).toBe("auto");
          expect(result.preferredPath).toBe(pythonCmd);
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "detects requirements.txt when present",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          await writeFile(
            path.join(dir, "requirements.txt"),
            "flask\n",
            "utf-8",
          );
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.packageFile).toBe("requirements.txt");
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "returns empty packageFile when requirements.txt is absent",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.packageFile).toBe("");
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "finds Python on PATH when no preferred path given",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          const result = await detectPythonInterpreter(dir);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(["python3", "python"]).toContain(result.preferredPath);
        });
      },
    );

    test("falls back to PATH when preferred path is bogus", () => {
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        const result = await detectPythonInterpreter(
          dir,
          "/nonexistent/python999",
        );
        if (pythonAvailable) {
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.preferredPath).not.toBe("/nonexistent/python999");
        } else {
          expect(result.config.version).toBe("");
        }
      });
    });
  },
);

// ---------------------------------------------------------------------------
// detectRInterpreter – runs a real R executable to get its version. Tests are
// skipped when R is not found on the PATH.
// ---------------------------------------------------------------------------

describe(
  "detectRInterpreter (real interpreter)",
  { timeout: 15_000 },
  async () => {
    const rAvailable = await isExecutableAvailable("R");

    test.skipIf(!rAvailable)("detects version from a real R executable", () =>
      withTempDir(async (dir) => {
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.packageManager).toBe("renv");
        expect(result.preferredPath).toBe("R");
      }),
    );

    test.skipIf(!rAvailable)(
      "finds R on PATH when no preferred path given",
      () =>
        withTempDir(async (dir) => {
          const result = await detectRInterpreter(dir);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.preferredPath).toBe("R");
        }),
    );

    test("falls back to PATH when preferred path is bogus", () =>
      withTempDir(async (dir) => {
        const result = await detectRInterpreter(dir, "/nonexistent/R999");
        if (rAvailable) {
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.preferredPath).not.toBe("/nonexistent/R999");
        } else {
          expect(result.config.version).toBe("");
        }
      }));
  },
);

// ---------------------------------------------------------------------------
// End-to-end Python detection – combines a real interpreter with project
// config files (.python-version, pyproject.toml, requirements.txt) to verify
// that both the executable version and the project's version constraints
// (requiresPython) are populated correctly together.
// ---------------------------------------------------------------------------

describe(
  "detectPythonInterpreter end-to-end",
  { timeout: 15_000 },
  async () => {
    const python3Available = await isExecutableAvailable("python3");
    const pythonAvailable =
      python3Available || (await isExecutableAvailable("python"));
    const pythonCmd = python3Available ? "python3" : "python";

    test.skipIf(!pythonAvailable)(
      "populates requiresPython from .python-version alongside real detection",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          await writeFile(path.join(dir, ".python-version"), "3.11", "utf-8");
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.config.requiresPython).toBe("~=3.11.0");
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "populates requiresPython from pyproject.toml",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          await writeFile(
            path.join(dir, "pyproject.toml"),
            '[project]\nrequires-python = ">=3.9,<4"\n',
            "utf-8",
          );
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.config.requiresPython).toBe(">=3.9,<4");
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "returns all fields together: version, packageFile, requiresPython",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          await writeFile(
            path.join(dir, "requirements.txt"),
            "flask>=2.0\n",
            "utf-8",
          );
          await writeFile(path.join(dir, ".python-version"), "3.10.5", "utf-8");
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.config.packageFile).toBe("requirements.txt");
          expect(result.config.packageManager).toBe("auto");
          expect(result.config.requiresPython).toBe("~=3.10.0");
          expect(result.preferredPath).toBe(pythonCmd);
        });
      },
    );

    test.skipIf(!pythonAvailable)(
      "omits requiresPython when no version constraint files exist",
      () => {
        clearPythonVersionCache();
        return withTempDir(async (dir) => {
          const result = await detectPythonInterpreter(dir, pythonCmd);
          expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(result.config.requiresPython).toBeUndefined();
        });
      },
    );
  },
);

// ---------------------------------------------------------------------------
// End-to-end R detection – combines a real R interpreter with project config
// files (DESCRIPTION, renv.lock) to verify that the executable version and
// requiresR constraint are populated together.
// ---------------------------------------------------------------------------

describe("detectRInterpreter end-to-end", { timeout: 15_000 }, async () => {
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!rAvailable)("populates requiresR from DESCRIPTION Depends", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.1.0), utils\n",
        "utf-8",
      );
      const result = await detectRInterpreter(dir, "R");
      expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.config.requiresR).toBe(">= 4.1.0");
    }),
  );

  test.skipIf(!rAvailable)("populates requiresR from renv.lock", () =>
    withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.2.3" } }),
        "utf-8",
      );
      const result = await detectRInterpreter(dir, "R");
      expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.config.requiresR).toBe("~=4.2.0");
    }),
  );

  test.skipIf(!rAvailable)(
    "returns all fields together: version, packageFile, requiresR",
    () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "renv.lock"),
          JSON.stringify({
            R: { Version: "4.3.1" },
            Packages: {},
          }),
          "utf-8",
        );
        await writeFile(
          path.join(dir, "DESCRIPTION"),
          "Package: mypkg\nDepends: R (>= 4.0.0)\n",
          "utf-8",
        );
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.packageManager).toBe("renv");
        // DESCRIPTION takes priority over renv.lock for requiresR
        expect(result.config.requiresR).toBe(">= 4.0.0");
        expect(result.preferredPath).toBe("R");
      }),
  );

  test.skipIf(!rAvailable)(
    "omits requiresR when no version constraint files exist",
    () =>
      withTempDir(async (dir) => {
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresR).toBeUndefined();
      }),
  );
});

// ---------------------------------------------------------------------------
// getInterpreterDefaults – the top-level orchestrator that state.ts calls to
// get defaults for both Python and R in a single call. Verifies that the full
// pipeline works for mixed-language, Python-only, and R-only projects. When
// one interpreter is not explicitly provided, detection will attempt to find
// it via PATH fallback, so expectations account for that.
// ---------------------------------------------------------------------------

describe("getInterpreterDefaults end-to-end", { timeout: 15_000 }, async () => {
  const python3Available = await isExecutableAvailable("python3");
  const pythonAvailable =
    python3Available || (await isExecutableAvailable("python"));
  const pythonCmd = python3Available ? "python3" : "python";
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!pythonAvailable || !rAvailable)(
    "detects both Python and R in a mixed project",
    () => {
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(path.join(dir, "requirements.txt"), "numpy\n", "utf-8");
        await writeFile(path.join(dir, ".python-version"), "3.11", "utf-8");
        await writeFile(
          path.join(dir, "DESCRIPTION"),
          "Package: mypkg\nDepends: R (>= 4.1.0)\n",
          "utf-8",
        );

        const result = await getInterpreterDefaults(dir, pythonCmd, "R");

        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.python.packageFile).toBe("requirements.txt");
        expect(result.python.requiresPython).toBe("~=3.11.0");
        expect(result.preferredPythonPath).toBe(pythonCmd);

        expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.r.requiresR).toBe(">= 4.1.0");
        expect(result.preferredRPath).toBe("R");
      });
    },
  );

  test.skipIf(!pythonAvailable)(
    "handles Python-only project gracefully",
    () => {
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf-8");

        const result = await getInterpreterDefaults(dir, pythonCmd);

        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.python.packageFile).toBe("requirements.txt");
        if (rAvailable) {
          expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
        } else {
          expect(result.r.version).toBe("");
        }
      });
    },
  );

  test.skipIf(!rAvailable)("handles R-only project gracefully", () => {
    clearPythonVersionCache();
    return withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.0.0)\n",
        "utf-8",
      );

      const result = await getInterpreterDefaults(dir, undefined, "R");

      expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.r.requiresR).toBe(">= 4.0.0");
      if (pythonAvailable) {
        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
      } else {
        expect(result.python.version).toBe("");
      }
    });
  });

  test.skipIf(!pythonAvailable)(
    "detects requirements.txt when given an absolute projectDir",
    () => {
      clearPythonVersionCache();
      return withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "requirements.txt"),
          "requests\n",
          "utf-8",
        );

        // dir is already absolute (from mkdtemp), matching the fixed call sites
        // in state.ts which now resolve projectDir against the workspace root.
        const result = await getInterpreterDefaults(dir, pythonCmd);

        expect(result.python.packageFile).toBe("requirements.txt");
        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    },
  );
});

// ---------------------------------------------------------------------------
// scanRPackages – runs a real R + renv to scan a temporary project for
// package dependencies and produce a lockfile. Tests are skipped when R or
// renv is not available on the system.
// ---------------------------------------------------------------------------

describe("scanRPackages (real R + renv)", async () => {
  const rAvailable = await isExecutableAvailable("R");
  const renvInstalled = rAvailable && (await isRenvAvailable());

  test.skipIf(!rAvailable || !renvInstalled)(
    "creates lockfile with default name",
    () =>
      withTempDir(async (dir) => {
        // Write a minimal R script (no external packages needed)
        await writeFile(
          path.join(dir, "script.R"),
          "# Minimal R project\nx <- 1\n",
          "utf-8",
        );

        await scanRPackages(dir, "R");

        const lockfilePath = path.join(dir, "renv.lock");
        expect(await fileExistsAt(lockfilePath)).toBe(true);

        const content = await readFileText(lockfilePath);
        expect(content).not.toBeNull();

        const parsed = JSON.parse(content!);
        expect(parsed).toHaveProperty("R");
        expect(parsed.R).toHaveProperty("Version");
        expect(parsed).toHaveProperty("Packages");
      }),
    120_000,
  );

  test.skipIf(!rAvailable || !renvInstalled)(
    "round-trip: scan then read with getRPackages",
    () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "script.R"),
          "# Minimal R project\nx <- 1\n",
          "utf-8",
        );

        await scanRPackages(dir, "R");

        const result = await getRPackages(dir, "renv.lock");
        expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.packages).toBeDefined();
        expect(typeof result.packages).toBe("object");
      }),
    120_000,
  );

  test.skipIf(!rAvailable || !renvInstalled)(
    "succeeds when project has stale .Rprofile but no renv/activate.R",
    () =>
      withTempDir(async (dir) => {
        // Reproduce the scenario that caused the original crash:
        // a .Rprofile from a previous renv setup references renv/activate.R,
        // but the renv/ directory has been removed (e.g. deleted or gitignored).
        await writeFile(
          path.join(dir, ".Rprofile"),
          'source("renv/activate.R")\n',
          "utf-8",
        );
        // Intentionally do NOT create renv/ or renv/activate.R

        await writeFile(
          path.join(dir, "script.R"),
          "# Minimal R project\nx <- 1\n",
          "utf-8",
        );

        // Without the --no-init-file and RENV_CONFIG_AUTOLOADER_ENABLED=FALSE
        // fixes, this would crash with:
        //   "cannot open file 'renv/activate.R': No such file or directory"
        await scanRPackages(dir, "R");

        const lockfilePath = path.join(dir, "renv.lock");
        expect(await fileExistsAt(lockfilePath)).toBe(true);

        const content = await readFileText(lockfilePath);
        expect(content).not.toBeNull();

        const parsed = JSON.parse(content!);
        expect(parsed).toHaveProperty("R");
        expect(parsed).toHaveProperty("Packages");
      }),
    120_000,
  );

  test.skipIf(!rAvailable || !renvInstalled)(
    "creates lockfile with custom name",
    () =>
      withTempDir(async (dir) => {
        await writeFile(
          path.join(dir, "script.R"),
          "# Minimal R project\nx <- 1\n",
          "utf-8",
        );

        await scanRPackages(dir, "R", "custom.lock");

        expect(await fileExistsAt(path.join(dir, "custom.lock"))).toBe(true);
        // Default name should NOT exist
        expect(await fileExistsAt(path.join(dir, "renv.lock"))).toBe(false);
      }),
    120_000,
  );
});

// ---------------------------------------------------------------------------
// scanPythonDependencies – runs a real Python executable to scan project
// files for imports, filter stdlib/local imports, and map to installed
// packages. Tests are skipped when Python is not available on the PATH.
// ---------------------------------------------------------------------------

describe(
  "scanPythonDependencies (real Python)",
  { timeout: 30_000 },
  async () => {
    const python3Available = await isExecutableAvailable("python3");
    const pythonAvailable =
      python3Available || (await isExecutableAvailable("python"));
    const pythonCmd = python3Available ? "python3" : "python";

    /** Check if a requirement appears as bare name or with version pin */
    function hasRequirement(reqs: string[], name: string): boolean {
      return reqs.some((r) => r === name || r.startsWith(name + "=="));
    }

    test.skipIf(!pythonAvailable)(
      "extracts imports from .py files and filters stdlib",
      () =>
        withTempDir(async (dir) => {
          await writeFile(
            path.join(dir, "app.py"),
            "import os\nimport sys\nimport numpy\nfrom scipy import stats\n",
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          // Should find numpy and scipy (may have ==version if installed)
          expect(hasRequirement(result.requirements, "numpy")).toBe(true);
          expect(hasRequirement(result.requirements, "scipy")).toBe(true);
          // Should NOT contain stdlib modules
          expect(hasRequirement(result.requirements, "os")).toBe(false);
          expect(hasRequirement(result.requirements, "sys")).toBe(false);
        }),
    );

    test.skipIf(!pythonAvailable)(
      "extracts imports from .ipynb notebooks",
      () =>
        withTempDir(async (dir) => {
          const notebook = {
            cells: [
              {
                cell_type: "code",
                source: ["import json\n", "import numpy as np\n"],
              },
              {
                cell_type: "markdown",
                source: ["# This is markdown, not code\n"],
              },
            ],
          };
          await writeFile(
            path.join(dir, "notebook.ipynb"),
            JSON.stringify(notebook),
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          // Should find numpy (may have ==version if installed)
          expect(hasRequirement(result.requirements, "numpy")).toBe(true);
          // Should NOT contain stdlib json
          expect(hasRequirement(result.requirements, "json")).toBe(false);
        }),
    );

    test.skipIf(!pythonAvailable)(
      "extracts imports across notebook cells without trailing newlines",
      () =>
        withTempDir(async (dir) => {
          // Jupyter notebooks often omit the trailing \n on the last line
          // of each cell. The scanner must insert a newline between cells
          // so that ast.parse doesn't see concatenated lines.
          const notebook = {
            cells: [
              {
                cell_type: "code",
                source: [
                  "import json\n",
                  "import numpy as np", // no trailing \n
                ],
              },
              {
                cell_type: "code",
                source: [
                  "import os\n",
                  "import csv", // no trailing \n
                ],
              },
            ],
          };
          await writeFile(
            path.join(dir, "notebook.ipynb"),
            JSON.stringify(notebook),
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          // numpy should be found despite the missing newlines between cells
          expect(hasRequirement(result.requirements, "numpy")).toBe(true);
          // stdlib imports should still be filtered
          expect(hasRequirement(result.requirements, "json")).toBe(false);
          expect(hasRequirement(result.requirements, "os")).toBe(false);
          expect(hasRequirement(result.requirements, "csv")).toBe(false);
        }),
    );

    test.skipIf(!pythonAvailable)(
      "maps import names to package names using RECORD when top_level.txt is absent",
      () =>
        withTempDir(async (dir) => {
          // scikit-learn (and increasingly other packages) ship without
          // top_level.txt. The scanner must fall back to dist.files to
          // discover that "sklearn" maps to "scikit-learn".
          await writeFile(
            path.join(dir, "app.py"),
            "from sklearn.linear_model import LinearRegression\n",
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          const entry = result.requirements.find(
            (r) => r === "sklearn" || r.startsWith("scikit-learn=="),
          );
          expect(entry).toBeDefined();
          // If scikit-learn is installed, the entry should use the real
          // package name, not the import name.
          if (entry!.includes("==")) {
            expect(entry).toMatch(/^scikit-learn==/);
          }
        }),
    );

    test.skipIf(!pythonAvailable)("extracts imports from .qmd files", () =>
      withTempDir(async (dir) => {
        const qmd = `---
title: "Test"
---

This is text, not code:
import notarealpythonimport

\`\`\`{python}
import numpy
from scipy import stats
\`\`\`
`;
        await writeFile(path.join(dir, "doc.qmd"), qmd, "utf-8");

        const result = await runPythonScanScript(dir, pythonCmd);

        // Should find numpy and scipy from code block (may have ==version if installed)
        expect(hasRequirement(result.requirements, "numpy")).toBe(true);
        expect(hasRequirement(result.requirements, "scipy")).toBe(true);
        // Should NOT find the fake import from text
        expect(
          hasRequirement(result.requirements, "notarealpythonimport"),
        ).toBe(false);
      }),
    );

    test.skipIf(!pythonAvailable)("filters local imports", () =>
      withTempDir(async (dir) => {
        // Create local module files
        await writeFile(
          path.join(dir, "helpers.py"),
          "# local module\n",
          "utf-8",
        );
        await mkdir(path.join(dir, "mypackage"));
        await writeFile(
          path.join(dir, "mypackage", "__init__.py"),
          "",
          "utf-8",
        );

        // Create main file that imports both local and third-party
        await writeFile(
          path.join(dir, "main.py"),
          "import helpers\nimport mypackage\nimport numpy\n",
          "utf-8",
        );

        const result = await runPythonScanScript(dir, pythonCmd);

        // Should find numpy (may have ==version if installed)
        expect(hasRequirement(result.requirements, "numpy")).toBe(true);
        // Should NOT find local imports
        expect(hasRequirement(result.requirements, "helpers")).toBe(false);
        expect(hasRequirement(result.requirements, "mypackage")).toBe(false);
      }),
    );

    test.skipIf(!pythonAvailable)(
      "maps installed packages to name==version format",
      () =>
        withTempDir(async (dir) => {
          // Import pip which is always available in any Python environment
          await writeFile(path.join(dir, "app.py"), "import pip\n", "utf-8");

          const result = await runPythonScanScript(dir, pythonCmd);

          // Should find pip with version
          const pipEntry = result.requirements.find((req) =>
            req.startsWith("pip=="),
          );
          expect(pipEntry).toBeDefined();
          expect(pipEntry).toMatch(/^pip==\d+\.\d+/);
        }),
    );

    test.skipIf(!pythonAvailable)(
      "reports uninstalled packages as incomplete",
      () =>
        withTempDir(async (dir) => {
          await writeFile(
            path.join(dir, "app.py"),
            "import zzzfakepackage_not_installed_12345\n",
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          // Should appear in both requirements (bare name) and incomplete
          expect(result.requirements).toContain(
            "zzzfakepackage_not_installed_12345",
          );
          expect(result.incomplete).toContain(
            "zzzfakepackage_not_installed_12345",
          );
        }),
    );

    test.skipIf(!pythonAvailable)(
      "end-to-end: writes requirements.txt with header",
      () =>
        withTempDir(async (dir) => {
          // Use pip which is always available
          await writeFile(path.join(dir, "app.py"), "import pip\n", "utf-8");

          const result = await scanPythonDependencies(
            dir,
            pythonCmd,
            "requirements.txt",
          );

          // Check result object
          expect(result.python).toBe(pythonCmd);
          expect(
            result.requirements.some((req) => req.startsWith("pip==")),
          ).toBe(true);

          // Check written file
          const requirementsPath = path.join(dir, "requirements.txt");
          expect(await fileExistsAt(requirementsPath)).toBe(true);

          const content = await readFileText(requirementsPath);
          expect(content).not.toBeNull();
          expect(content).toContain("# requirements.txt auto-generated");
          expect(content).toContain(`using ${pythonCmd}`);
          expect(content).toMatch(/pip==\d+\.\d+/);
        }),
    );

    test.skipIf(!pythonAvailable)(
      "parity: Go testdata fixtures produce expected imports",
      () =>
        withTempDir(async (dir) => {
          // Recreate the Go testdata structure
          // example.py: imports numpy, scipy, and local lib.utils
          await writeFile(
            path.join(dir, "example.py"),
            "import numpy as np\nimport scipy\n\nfrom lib.utils import foo\n",
            "utf-8",
          );

          // lib/utils.py: imports somelib
          await mkdir(path.join(dir, "lib"));
          await writeFile(
            path.join(dir, "lib", "utils.py"),
            "from somelib import somefunc\n\ndef foo():\n    somefunc()\n",
            "utf-8",
          );

          // test.qmd: imports that and example (local)
          const qmd = `---
title: "test-qmd"
jupyter: python3
---

This is a Quarto file with embedded Python code.

import this

Not actually an import! That's not in a code block.

\`\`\`{python}
import that
from example import *

that.do_something()
\`\`\`
`;
          await writeFile(path.join(dir, "test.qmd"), qmd, "utf-8");

          // good_notebook.ipynb: only imports sys (stdlib)
          const notebook = {
            cells: [
              {
                cell_type: "code",
                source: ["import sys\n", "print(sys.executable)\n"],
              },
              {
                cell_type: "code",
                source: ["print('Summing')\n", "123 + 456\n"],
              },
            ],
          };
          await writeFile(
            path.join(dir, "good_notebook.ipynb"),
            JSON.stringify(notebook),
            "utf-8",
          );

          const result = await runPythonScanScript(dir, pythonCmd);

          // Should contain third-party imports (may have ==version if installed)
          expect(hasRequirement(result.requirements, "numpy")).toBe(true);
          expect(hasRequirement(result.requirements, "scipy")).toBe(true);
          expect(hasRequirement(result.requirements, "somelib")).toBe(true);
          expect(hasRequirement(result.requirements, "that")).toBe(true);

          // Should NOT contain local imports
          expect(hasRequirement(result.requirements, "lib")).toBe(false);
          expect(hasRequirement(result.requirements, "example")).toBe(false);

          // Should NOT contain stdlib imports
          expect(hasRequirement(result.requirements, "sys")).toBe(false);
          expect(hasRequirement(result.requirements, "this")).toBe(false);
        }),
    );
  },
);
