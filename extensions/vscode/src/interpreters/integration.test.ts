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
// The tests are organized in layers from low-level to high-level:
//   1. fsUtils          – filesystem helpers (readFileText, fileExistsAt)
//   2. getPythonRequires – version constraint extraction from project files
//   3. getRRequires      – version constraint extraction from R project files
//   4. detectPythonInterpreter – full Python detection (exec + project files)
//   5. detectRInterpreter      – full R detection (exec + project files)
//   6. End-to-end tests  – detection + project files combined
//   7. getInterpreterDefaults  – top-level orchestrator for both interpreters
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
import { afterAll, beforeAll, describe, expect, test } from "vitest";
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

// Shared temp directory for simple tests that don't need isolation.
// Tests that verify priority ordering or need a clean project directory
// create their own temp dirs to avoid file leakage between tests.
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** Write a file into the shared temp project directory. */
async function writeProjectFile(filename: string, content: string) {
  await writeFile(path.join(tmpDir, filename), content, "utf-8");
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
// Layer 1: fsUtils – verify basic file I/O helpers against real disk
// ---------------------------------------------------------------------------

describe("fsUtils (real filesystem)", () => {
  test("readFileText reads an existing file", async () => {
    const filePath = path.join(tmpDir, "hello.txt");
    await writeFile(filePath, "hello world", "utf-8");
    const result = await readFileText(filePath);
    expect(result).toBe("hello world");
  });

  test("readFileText returns null for a missing file", async () => {
    const result = await readFileText(path.join(tmpDir, "nonexistent.txt"));
    expect(result).toBeNull();
  });

  test("fileExistsAt returns true for an existing file", async () => {
    const filePath = path.join(tmpDir, "exists.txt");
    await writeFile(filePath, "", "utf-8");
    expect(await fileExistsAt(filePath)).toBe(true);
  });

  test("fileExistsAt returns false for a missing file", async () => {
    expect(await fileExistsAt(path.join(tmpDir, "nope.txt"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: getPythonRequires – version constraint extraction from real files
// Each test creates its own temp dir to avoid cross-test file interference.
// ---------------------------------------------------------------------------

describe("getPythonRequires (real filesystem)", () => {
  test("returns empty string when project has no python config files", async () => {
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), "publisher-empty-"));
    try {
      expect(await getPythonRequires(emptyDir)).toBe("");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  test("reads .python-version file", async () => {
    await writeProjectFile(".python-version", "3.11.4");
    const result = await getPythonRequires(tmpDir);
    expect(result).toBe("~=3.11.0");
  });

  test("reads requires-python from pyproject.toml", async () => {
    // Use a fresh dir so .python-version doesn't interfere
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pyproj-"));
    try {
      await writeFile(
        path.join(dir, "pyproject.toml"),
        '[project]\nrequires-python = ">=3.9"\n',
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe(">=3.9");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reads python_requires from setup.cfg", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-setupcfg-"));
    try {
      await writeFile(
        path.join(dir, "setup.cfg"),
        "[options]\npython_requires = >=3.8\n",
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe(">=3.8");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test(".python-version takes priority over pyproject.toml", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-priority-"));
    try {
      await writeFile(path.join(dir, ".python-version"), "3.10", "utf-8");
      await writeFile(
        path.join(dir, "pyproject.toml"),
        '[project]\nrequires-python = ">=3.8"\n',
        "utf-8",
      );
      expect(await getPythonRequires(dir)).toBe("~=3.10.0");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3: getRRequires – R version constraint extraction from real files
// ---------------------------------------------------------------------------

describe("getRRequires (real filesystem)", () => {
  test("returns empty string when project has no R config files", async () => {
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), "publisher-empty-"));
    try {
      expect(await getRRequires(emptyDir)).toBe("");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  test("reads R version from DESCRIPTION Depends", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-desc-"));
    try {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.1.0), utils\n",
        "utf-8",
      );
      expect(await getRRequires(dir)).toBe(">= 4.1.0");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reads R version from renv.lock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-renv-"));
    try {
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.3.1" } }),
        "utf-8",
      );
      expect(await getRRequires(dir)).toBe("~=4.3.0");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("DESCRIPTION takes priority over renv.lock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rpriority-"));
    try {
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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 4: detectPythonInterpreter – runs a real Python executable to get its
// version, and checks for requirements.txt on disk. Tests are skipped when
// no Python interpreter is found on the PATH.
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
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pydetect-"));
      try {
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.packageManager).toBe("auto");
        expect(result.preferredPath).toBe(pythonCmd);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "detects requirements.txt when present",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pyreqs-"));
      try {
        await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf-8");
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.packageFile).toBe("requirements.txt");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "returns empty packageFile when requirements.txt is absent",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pynoreqs-"));
      try {
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.packageFile).toBe("");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "finds Python on PATH when no preferred path given",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pypath-"));
      try {
        const result = await detectPythonInterpreter(dir);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(["python3", "python"]).toContain(result.preferredPath);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test("falls back to PATH when preferred path is bogus", async () => {
    clearPythonVersionCache();
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pybogus-"));
    try {
      const result = await detectPythonInterpreter(
        dir,
        "/nonexistent/python999",
      );
      if (pythonAvailable) {
        // PATH fallback should find a real interpreter
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.preferredPath).not.toBe("/nonexistent/python999");
      } else {
        expect(result.config.version).toBe("");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 5: detectRInterpreter – runs a real R executable to get its version.
// Tests are skipped when R is not found on the PATH.
// ---------------------------------------------------------------------------

describe("detectRInterpreter (real interpreter)", async () => {
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!rAvailable)(
    "detects version from a real R executable",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rdetect-"));
      try {
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.packageManager).toBe("renv");
        expect(result.preferredPath).toBe("R");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!rAvailable)(
    "finds R on PATH when no preferred path given",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rpath-"));
      try {
        const result = await detectRInterpreter(dir);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.preferredPath).toBe("R");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test("falls back to PATH when preferred path is bogus", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rbogus-"));
    try {
      const result = await detectRInterpreter(dir, "/nonexistent/R999");
      if (rAvailable) {
        // PATH fallback should find a real interpreter
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.preferredPath).not.toBe("/nonexistent/R999");
      } else {
        expect(result.config.version).toBe("");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 6a: End-to-end Python detection – combines a real interpreter with
// project config files (.python-version, pyproject.toml, requirements.txt)
// to verify that both the executable version and the project's version
// constraints (requiresPython) are populated correctly together.
// ---------------------------------------------------------------------------

describe("detectPythonInterpreter end-to-end", async () => {
  const python3Available = await isExecutableAvailable("python3");
  const pythonAvailable =
    python3Available || (await isExecutableAvailable("python"));
  const pythonCmd = python3Available ? "python3" : "python";

  test.skipIf(!pythonAvailable)(
    "populates requiresPython from .python-version alongside real detection",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pye2e-"));
      try {
        await writeFile(path.join(dir, ".python-version"), "3.11", "utf-8");
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresPython).toBe("~=3.11.0");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "populates requiresPython from pyproject.toml",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pye2e-"));
      try {
        await writeFile(
          path.join(dir, "pyproject.toml"),
          '[project]\nrequires-python = ">=3.9,<4"\n',
          "utf-8",
        );
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresPython).toBe(">=3.9,<4");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "returns all fields together: version, packageFile, requiresPython",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pyfull-"));
      try {
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
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "omits requiresPython when no version constraint files exist",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pynoreq-"));
      try {
        const result = await detectPythonInterpreter(dir, pythonCmd);
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresPython).toBeUndefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Layer 6b: End-to-end R detection – combines a real R interpreter with
// project config files (DESCRIPTION, renv.lock) to verify that the
// executable version and requiresR constraint are populated together.
// ---------------------------------------------------------------------------

describe("detectRInterpreter end-to-end", async () => {
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!rAvailable)(
    "populates requiresR from DESCRIPTION Depends",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-re2e-"));
      try {
        await writeFile(
          path.join(dir, "DESCRIPTION"),
          "Package: mypkg\nDepends: R (>= 4.1.0), utils\n",
          "utf-8",
        );
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresR).toBe(">= 4.1.0");
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!rAvailable)("populates requiresR from renv.lock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-re2e-"));
    try {
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.2.3" } }),
        "utf-8",
      );
      const result = await detectRInterpreter(dir, "R");
      expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.config.requiresR).toBe("~=4.2.0");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(!rAvailable)(
    "returns all fields together: version, packageFile, requiresR",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rfull-"));
      try {
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
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!rAvailable)(
    "omits requiresR when no version constraint files exist",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-rnoreq-"));
      try {
        const result = await detectRInterpreter(dir, "R");
        expect(result.config.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.config.requiresR).toBeUndefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Layer 7: getInterpreterDefaults – the top-level orchestrator that state.ts
// calls to get defaults for both Python and R in a single call. Verifies
// that the full pipeline works for mixed-language, Python-only, and R-only
// projects. When one interpreter is not explicitly provided, detection will
// attempt to find it via PATH fallback, so expectations account for that.
// ---------------------------------------------------------------------------

describe("getInterpreterDefaults end-to-end", async () => {
  const python3Available = await isExecutableAvailable("python3");
  const pythonAvailable =
    python3Available || (await isExecutableAvailable("python"));
  const pythonCmd = python3Available ? "python3" : "python";
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!pythonAvailable || !rAvailable)(
    "detects both Python and R in a mixed project",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-both-"));
      try {
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
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!pythonAvailable)(
    "handles Python-only project gracefully",
    async () => {
      clearPythonVersionCache();
      const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-pyonly-"));
      try {
        await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf-8");

        const result = await getInterpreterDefaults(dir, pythonCmd);

        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.python.packageFile).toBe("requirements.txt");
        // R may still be detected via PATH fallback
        if (rAvailable) {
          expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
        } else {
          expect(result.r.version).toBe("");
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  test.skipIf(!rAvailable)("handles R-only project gracefully", async () => {
    clearPythonVersionCache();
    const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-ronly-"));
    try {
      await writeFile(
        path.join(dir, "DESCRIPTION"),
        "Package: mypkg\nDepends: R (>= 4.0.0)\n",
        "utf-8",
      );

      const result = await getInterpreterDefaults(dir, undefined, "R");

      expect(result.r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.r.requiresR).toBe(">= 4.0.0");
      // Python may still be detected via PATH fallback
      if (pythonAvailable) {
        expect(result.python.version).toMatch(/^\d+\.\d+\.\d+$/);
      } else {
        expect(result.python.version).toBe("");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
