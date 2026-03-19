// Copyright (C) 2026 by Posit Software, PBC.

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ContentType } from "../api/types/configurations";
import {
  cleanupExtraDependencies,
  findExtraDependencies,
  recordExtraDependencies,
} from "./extraDependencies";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("../interpreters/fsUtils", () => ({
  fileExistsAt: vi.fn(),
}));

// Import the mock after vi.mock so we can configure it per-test
import { fileExistsAt } from "../interpreters/fsUtils";
const mockFileExistsAt = vi.mocked(fileExistsAt);
const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockUnlink = vi.mocked(unlink);

const PROJECT_DIR = "/fake/project";

beforeEach(() => {
  vi.resetAllMocks();
});

// ---- findExtraDependencies ----

describe("findExtraDependencies", () => {
  test("RMD_SHINY returns shiny and rmarkdown", async () => {
    const deps = await findExtraDependencies(
      ContentType.RMD_SHINY,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["shiny", "rmarkdown"]);
  });

  test("QUARTO_SHINY returns shiny and rmarkdown", async () => {
    const deps = await findExtraDependencies(
      ContentType.QUARTO_SHINY,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["shiny", "rmarkdown"]);
  });

  test("QUARTO returns rmarkdown", async () => {
    const deps = await findExtraDependencies(
      ContentType.QUARTO,
      false,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["rmarkdown"]);
  });

  test("QUARTO_STATIC returns rmarkdown", async () => {
    const deps = await findExtraDependencies(
      ContentType.QUARTO_STATIC,
      false,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["rmarkdown"]);
  });

  test("RMD returns rmarkdown", async () => {
    const deps = await findExtraDependencies(
      ContentType.RMD,
      false,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["rmarkdown"]);
  });

  test("QUARTO with parameters returns rmarkdown and shiny", async () => {
    const deps = await findExtraDependencies(
      ContentType.QUARTO,
      true,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["rmarkdown", "shiny"]);
  });

  test("RMD with parameters returns rmarkdown and shiny", async () => {
    const deps = await findExtraDependencies(
      ContentType.RMD,
      true,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["rmarkdown", "shiny"]);
  });

  test("R_SHINY returns shiny", async () => {
    const deps = await findExtraDependencies(
      ContentType.R_SHINY,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["shiny"]);
  });

  test("R_PLUMBER reads engine from _server.yml", async () => {
    mockFileExistsAt.mockResolvedValueOnce(true);
    mockReadFile.mockResolvedValueOnce("engine: plumber" as never);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["plumber"]);
    expect(mockReadFile).toHaveBeenCalledWith(
      path.join(PROJECT_DIR, "_server.yml"),
      "utf-8",
    );
  });

  test("R_PLUMBER reads engine from _server.yaml when .yml missing", async () => {
    mockFileExistsAt.mockResolvedValueOnce(false); // _server.yml
    mockFileExistsAt.mockResolvedValueOnce(true); // _server.yaml
    mockReadFile.mockResolvedValueOnce("engine: plumber2" as never);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["plumber2"]);
  });

  test("R_PLUMBER returns empty when no server file exists", async () => {
    mockFileExistsAt.mockResolvedValue(false);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual([]);
  });

  test("R_PLUMBER strips quotes from engine value", async () => {
    mockFileExistsAt.mockResolvedValueOnce(true);
    mockReadFile.mockResolvedValueOnce('engine: "plumber"' as never);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["plumber"]);
  });

  test("R_PLUMBER strips trailing comments from engine value", async () => {
    mockFileExistsAt.mockResolvedValueOnce(true);
    mockReadFile.mockResolvedValueOnce("engine: plumber # v1 API" as never);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual(["plumber"]);
  });

  test("R_PLUMBER returns empty when server file has no engine line", async () => {
    mockFileExistsAt.mockResolvedValueOnce(true);
    mockReadFile.mockResolvedValueOnce("docs: true\n" as never);

    const deps = await findExtraDependencies(
      ContentType.R_PLUMBER,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual([]);
  });

  test("Python content type returns empty", async () => {
    const deps = await findExtraDependencies(
      ContentType.PYTHON_SHINY,
      undefined,
      PROJECT_DIR,
    );
    expect(deps).toEqual([]);
  });
});

// ---- recordExtraDependencies ----

describe("recordExtraDependencies", () => {
  test("returns null for empty deps", async () => {
    const result = await recordExtraDependencies(PROJECT_DIR, []);
    expect(result).toBeNull();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test("writes library calls and returns path", async () => {
    const result = await recordExtraDependencies(PROJECT_DIR, [
      "shiny",
      "rmarkdown",
    ]);

    const expectedPath = path.join(PROJECT_DIR, ".posit", "__publisher_deps.R");
    expect(result).toBe(expectedPath);
    expect(mockMkdir).toHaveBeenCalledWith(path.join(PROJECT_DIR, ".posit"), {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expectedPath,
      'library("shiny")\nlibrary("rmarkdown")\n',
      "utf-8",
    );
  });
});

// ---- cleanupExtraDependencies ----

describe("cleanupExtraDependencies", () => {
  test("calls unlink on the file", async () => {
    await cleanupExtraDependencies("/some/path");
    expect(mockUnlink).toHaveBeenCalledWith("/some/path");
  });

  test("ignores errors from unlink", async () => {
    mockUnlink.mockRejectedValueOnce(new Error("ENOENT"));
    await expect(
      cleanupExtraDependencies("/missing/path"),
    ).resolves.toBeUndefined();
  });
});
