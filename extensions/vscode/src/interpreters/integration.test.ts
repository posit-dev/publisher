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
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

describe("detectPythonInterpreter (real interpreter)", async () => {
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

  test.skipIf(!pythonAvailable)("detects requirements.txt when present", () => {
    clearPythonVersionCache();
    return withTempDir(async (dir) => {
      await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf-8");
      const result = await detectPythonInterpreter(dir, pythonCmd);
      expect(result.config.packageFile).toBe("requirements.txt");
    });
  });

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
});

// ---------------------------------------------------------------------------
// detectRInterpreter – runs a real R executable to get its version. Tests are
// skipped when R is not found on the PATH.
// ---------------------------------------------------------------------------

describe("detectRInterpreter (real interpreter)", async () => {
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!rAvailable)("detects version from a real R executable", () =>
    withTempDir(async (dir) => {
      const result = await detectRInterpreter(dir, "R");
      expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.config.packageManager).toBe("renv");
      expect(result.preferredPath).toBe("R");
    }),
  );

  test.skipIf(!rAvailable)("finds R on PATH when no preferred path given", () =>
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
});

// ---------------------------------------------------------------------------
// End-to-end Python detection – combines a real interpreter with project
// config files (.python-version, pyproject.toml, requirements.txt) to verify
// that both the executable version and the project's version constraints
// (requiresPython) are populated correctly together.
// ---------------------------------------------------------------------------

describe("detectPythonInterpreter end-to-end", async () => {
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
});

// ---------------------------------------------------------------------------
// End-to-end R detection – combines a real R interpreter with project config
// files (DESCRIPTION, renv.lock) to verify that the executable version and
// requiresR constraint are populated together.
// ---------------------------------------------------------------------------

describe("detectRInterpreter end-to-end", async () => {
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

describe("getInterpreterDefaults end-to-end", async () => {
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
});
