// Copyright (C) 2026 by Posit Software, PBC.
//
// Integration tests that run against a real filesystem and real interpreters.
// Interpreter-specific tests are skipped when the executable is not available.

import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { readFileText, fileExistsAt } from "./fsUtils";
import { getPythonRequires } from "./pythonRequires";
import { getRRequires } from "./rRequires";
import { detectPythonInterpreter, clearPythonVersionCache } from "./pythonInterpreter";
import { detectRInterpreter } from "./rInterpreter";

const execFileAsync = promisify(execFile);

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "publisher-test-"));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** Write a file into the temp project directory. */
async function writeProjectFile(filename: string, content: string) {
  await writeFile(path.join(tmpDir, filename), content, "utf-8");
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

// ---------------------------------------------------------------------------
// fsUtils
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
// getPythonRequires
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
// getRRequires
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
// detectPythonInterpreter (requires Python on PATH)
// ---------------------------------------------------------------------------

describe("detectPythonInterpreter (real interpreter)", async () => {
  // Check for python3 first, fall back to python
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
    const dir = await mkdtemp(
      path.join(os.tmpdir(), "publisher-pybogus-"),
    );
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
// detectRInterpreter (requires R on PATH)
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
