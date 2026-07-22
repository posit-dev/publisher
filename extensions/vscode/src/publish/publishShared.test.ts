// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildManifest, cleanUpBundle } from "./publishShared";
import type { ConfigurationDetails } from "../api/types/configurations";
import { ContentType } from "../api/types/configurations";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../interpreters/rPackages", () => ({
  scanRPackages: vi.fn(),
}));

vi.mock("./dependencies", () => ({
  resolveRPackages: vi.fn(),
}));

vi.mock("./extraDependencies", () => ({
  findExtraDependencies: vi.fn().mockResolvedValue([]),
  recordExtraDependencies: vi.fn().mockResolvedValue(undefined),
  cleanupExtraDependencies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../bundler/manifestFromConfig", () => ({
  manifestFromConfig: vi.fn().mockReturnValue({
    version: 1,
    metadata: {},
    packages: undefined,
    files: {},
  }),
}));

vi.mock("../utils/fsUtils", () => ({
  fileExistsAt: vi.fn(),
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    mkdtemp: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

import { scanRPackages } from "../interpreters/rPackages";
import { resolveRPackages } from "./dependencies";
import {
  findExtraDependencies,
  recordExtraDependencies,
  cleanupExtraDependencies,
} from "./extraDependencies";
import { fileExistsAt } from "../utils/fsUtils";

const mockScanRPackages = vi.mocked(scanRPackages);
const mockResolveRPackages = vi.mocked(resolveRPackages);
const mockFindExtraDependencies = vi.mocked(findExtraDependencies);
const mockRecordExtraDependencies = vi.mocked(recordExtraDependencies);
const mockCleanupExtraDependencies = vi.mocked(cleanupExtraDependencies);
const mockFileExistsAt = vi.mocked(fileExistsAt);
const mockMkdtemp = vi.mocked(fs.mkdtemp);
const mockRm = vi.mocked(fs.rm);

const noopProgress = () => {};

function makeRConfig(overrides?: object): ConfigurationDetails {
  return {
    type: ContentType.R_SHINY,
    entrypoint: "app.R",
    r: {
      version: "4.3.0",
      packageFile: "renv.lock",
      packageManager: "renv",
      requiresR: true,
    },
    ...overrides,
  } as unknown as ConfigurationDetails;
}

const FAKE_LOCKFILE_JSON = JSON.stringify({
  R: {
    Version: "4.3.0",
    Repositories: [{ Name: "CRAN", URL: "https://cran.r-project.org" }],
  },
  Packages: {},
});

describe("buildManifest — auto-generate ephemeral branch (no renv.lock on disk)", () => {
  const projectDir = "/project";
  const tmpDir = "/tmp/publisher-renv-abc123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExistsAt.mockResolvedValue(false); // no lockfile on disk
    mockMkdtemp.mockResolvedValue(tmpDir);
    mockScanRPackages.mockResolvedValue(undefined);
    mockResolveRPackages.mockResolvedValue({
      packages: {},
      lockfilePath: path.join(tmpDir, "renv.lock"),
      lockfile: JSON.parse(FAKE_LOCKFILE_JSON),
    });
    mockFindExtraDependencies.mockResolvedValue([]);
    mockRecordExtraDependencies.mockResolvedValue(null);
    mockCleanupExtraDependencies.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
  });

  test("creates temp dir under os.tmpdir()", async () => {
    const config = makeRConfig();
    await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    expect(mockMkdtemp).toHaveBeenCalledWith(
      path.join(os.tmpdir(), "publisher-renv-"),
    );
  });

  test("calls scanRPackages with tmpDir as renvTargetDir", async () => {
    const config = makeRConfig();
    await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    expect(mockScanRPackages).toHaveBeenCalledWith(
      projectDir,
      "/usr/bin/R",
      "renv.lock",
      undefined,
      tmpDir,
    );
  });

  test("resolves packages from tmpDir, not projectDir", async () => {
    const config = makeRConfig();
    await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    expect(mockResolveRPackages).toHaveBeenCalledWith(tmpDir, {
      packageFile: "renv.lock",
    });
  });

  test("returns lockfilePath undefined and lockfile populated", async () => {
    const config = makeRConfig();
    const result = await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    // lockfilePath is undefined: renv.lock was never in the config's files list
    // (it didn't exist at inspect time), so we don't add it to the bundle.
    expect(result.lockfilePath).toBeUndefined();
    // lockfile (parsed object) is still returned for the deployment record.
    expect(result.lockfile).toBeDefined();
  });

  test("removes tmpDir in finally even when resolveRPackages throws", async () => {
    const depsFile = path.join(projectDir, ".posit/__publisher_deps.R");
    mockRecordExtraDependencies.mockResolvedValue(depsFile);
    mockResolveRPackages.mockRejectedValue(new Error("parse error"));
    const config = makeRConfig();

    await expect(
      buildManifest(projectDir, config, "/usr/bin/R", undefined, noopProgress),
    ).rejects.toThrow("parse error");

    expect(mockRm).toHaveBeenCalledWith(tmpDir, {
      recursive: true,
      force: true,
    });
    expect(mockCleanupExtraDependencies).toHaveBeenCalledWith(depsFile);
  });

  test("cleans up depsFile even when mkdtemp fails", async () => {
    const depsFile = path.join(projectDir, ".posit/__publisher_deps.R");
    mockRecordExtraDependencies.mockResolvedValue(depsFile);
    mockMkdtemp.mockRejectedValue(new Error("ENOSPC"));
    const config = makeRConfig();

    await expect(
      buildManifest(projectDir, config, "/usr/bin/R", undefined, noopProgress),
    ).rejects.toThrow("ENOSPC");

    expect(mockCleanupExtraDependencies).toHaveBeenCalledWith(depsFile);
    expect(mockRm).not.toHaveBeenCalled();
  });

  test("removes tmpDir in finally even when scanRPackages throws", async () => {
    mockScanRPackages.mockRejectedValue(new Error("R scan failed"));
    const config = makeRConfig();

    await expect(
      buildManifest(projectDir, config, "/usr/bin/R", undefined, noopProgress),
    ).rejects.toThrow("R scan failed");

    expect(mockRm).toHaveBeenCalledWith(tmpDir, {
      recursive: true,
      force: true,
    });
  });

  test("removes tmpDir on success", async () => {
    const config = makeRConfig();
    await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    expect(mockRm).toHaveBeenCalledWith(tmpDir, {
      recursive: true,
      force: true,
    });
  });

  test("throws when no R interpreter is available", async () => {
    const config = makeRConfig();
    await expect(
      buildManifest(projectDir, config, undefined, undefined, noopProgress),
    ).rejects.toThrow("R interpreter is required");

    // No tmpDir created if R is missing
    expect(mockMkdtemp).not.toHaveBeenCalled();
  });
});

describe("buildManifest — lockExists branch (existing renv.lock)", () => {
  const projectDir = "/project";

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExistsAt.mockResolvedValue(true); // lockfile present
    mockResolveRPackages.mockResolvedValue({
      packages: {},
      lockfilePath: path.join(projectDir, "renv.lock"),
      lockfile: JSON.parse(FAKE_LOCKFILE_JSON),
    });
  });

  test("reads lockfile from project, skips scan and temp dir", async () => {
    const config = makeRConfig();
    const result = await buildManifest(
      projectDir,
      config,
      "/usr/bin/R",
      undefined,
      noopProgress,
    );

    expect(result.lockfilePath).toBe(path.join(projectDir, "renv.lock"));
    expect(mockScanRPackages).not.toHaveBeenCalled();
    expect(mockMkdtemp).not.toHaveBeenCalled();
  });
});

describe("cleanUpBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
  });

  test("no-op when tmpDir is undefined", async () => {
    await expect(cleanUpBundle(undefined)).resolves.toBeUndefined();
    expect(mockRm).not.toHaveBeenCalled();
  });

  test("removes tmpDir", async () => {
    await cleanUpBundle("/tmp/bundle-dir");
    expect(mockRm).toHaveBeenCalledWith("/tmp/bundle-dir", {
      recursive: true,
      force: true,
    });
  });

  test("does not throw if fs.rm rejects", async () => {
    mockRm.mockRejectedValueOnce(new Error("EACCES: permission denied"));
    await expect(cleanUpBundle("/tmp/bundle-dir")).resolves.toBeUndefined();
  });
});
