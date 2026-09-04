// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { inspectManualContentType, inspectProject } from "./index";
import { ContentType } from "src/api/types/configurations";

const { mockReaddir, mockStat, mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock("src/logging");

vi.mock("fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mockReadFile,
  access: mockAccess,
}));

vi.mock("src/interpreters/pythonInterpreter", () => ({
  detectPythonInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "3.11.0",
      packageFile: "requirements.txt",
      packageManager: "auto",
    },
    preferredPath: "python3",
  }),
}));

vi.mock("src/interpreters/rInterpreter", () => ({
  detectRInterpreter: vi.fn().mockResolvedValue({
    config: {
      version: "4.3.0",
      packageFile: "renv.lock",
      packageManager: "renv",
    },
    preferredPath: "R",
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("inspectProject", () => {
  test("returns ConfigurationInspectionResult[] for flask project", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({
      projectDir: "/myproject",
      pythonPath: "python3",
    });

    expect(results.length).toBeGreaterThan(0);
    const flask = results.find(
      (r) => r.configuration.type === ContentType.PYTHON_FLASK,
    );
    expect(flask).toBeDefined();
    expect(flask?.configuration.entrypoint).toBe("app.py");
    expect(flask?.configuration.$schema).toContain("posit-publishing-schema");
    expect(flask?.configuration.validate).toBe(true);
    expect(flask?.projectDir).toBe(".");
  });

  test("returns unknown config for empty project", async () => {
    mockReaddir.mockResolvedValue([]);
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({ projectDir: "/empty" });
    expect(results).toHaveLength(1);
    expect(results[0]?.configuration.type).toBe(ContentType.UNKNOWN);
  });

  test("sets projectDir to '.' for non-recursive", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({ projectDir: "/project" });
    for (const result of results) {
      expect(result.projectDir).toBe(".");
    }
  });

  test("uses relativeDir as projectDir in results when provided", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({
      projectDir: "/workspace/fastapi-simple",
      relativeDir: "fastapi-simple",
    });
    for (const result of results) {
      expect(result.projectDir).toBe("fastapi-simple");
    }
  });

  test("defaults projectDir to '.' when relativeDir is not provided", async () => {
    mockReaddir.mockResolvedValue(["app.py"]);
    mockStat.mockResolvedValue({ isFile: () => true });
    mockReadFile.mockResolvedValue("from flask import Flask\n");
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const results = await inspectProject({
      projectDir: "/workspace/fastapi-simple",
    });
    for (const result of results) {
      expect(result.projectDir).toBe(".");
    }
  });
});

describe("inspectManualContentType", () => {
  test("fills in an empty python placeholder for python content types", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await inspectManualContentType(
      { projectDir: "/myproject", entrypoint: "app.py" },
      ContentType.PYTHON_FASTAPI,
    );

    expect(result.configuration.type).toBe(ContentType.PYTHON_FASTAPI);
    expect(result.configuration.entrypoint).toBe("app.py");
    expect(result.configuration.python).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
    expect(result.configuration.r).toBeUndefined();
    expect(result.configuration.files).toContain("/requirements.txt");
  });

  test("fills in an empty r placeholder for r content types", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await inspectManualContentType(
      { projectDir: "/myproject", entrypoint: "app.R" },
      ContentType.R_SHINY,
    );

    expect(result.configuration.type).toBe(ContentType.R_SHINY);
    expect(result.configuration.r).toEqual({
      version: "",
      packageFile: "",
      packageManager: "",
    });
    expect(result.configuration.python).toBeUndefined();
    expect(result.configuration.files).toContain("/renv.lock");
  });

  test("fills in a default quarto version for quarto content types", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await inspectManualContentType(
      { projectDir: "/myproject", entrypoint: "report.qmd" },
      ContentType.QUARTO,
    );

    expect(result.configuration.type).toBe(ContentType.QUARTO);
    expect(result.configuration.quarto?.version).toBeTruthy();
  });

  test("sets neither python, r, nor quarto for content types that don't need them", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await inspectManualContentType(
      { projectDir: "/myproject", entrypoint: "index.html" },
      ContentType.HTML,
    );

    expect(result.configuration.type).toBe(ContentType.HTML);
    expect(result.configuration.python).toBeUndefined();
    expect(result.configuration.r).toBeUndefined();
    expect(result.configuration.quarto).toBeUndefined();
  });

  test("uses the provided relativeDir as the result's projectDir", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const result = await inspectManualContentType(
      {
        projectDir: "/workspace/myapp",
        entrypoint: "app.py",
        relativeDir: "myapp",
      },
      ContentType.PYTHON_SHINY,
    );

    expect(result.projectDir).toBe("myapp");
  });
});
