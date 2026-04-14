// Copyright (C) 2026 by Posit Software, PBC.
//
// Integration tests for the R library mapper.
//
// Unlike the unit tests (rLibraryMapper.test.ts) which mock the PackageLister
// interface, these tests exercise the real code paths against:
//   - Real R subprocesses (getLibPaths, listAvailablePackages)
//   - Real renv library directories (readPackageDescription)
//   - Real renv::init() to populate a project's library
//
// Tests that require R or renv use `test.skipIf(!available)` so the suite can
// run in any environment without failures. In CI, the
// interpreter-integration.yaml workflow installs known R versions with renv
// across a matrix of configurations to ensure full coverage.
//
// Run these tests with:
//   npx vitest run src/publish/integration.test.ts
//
// Or as part of the dedicated npm script:
//   npm run test-integration-publish

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import {
  getLibPaths,
  listAvailablePackages,
  readPackageDescription,
  libraryToManifestPackages,
  type PackageLister,
} from "./rLibraryMapper";

const execFileAsync = promisify(execFile);

/** Create a temp directory, pass it to `fn`, then clean up. */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "publisher-libmap-"));
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
 * Used to determine whether renv-dependent tests should be skipped.
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
// getLibPaths — real R subprocess
// ---------------------------------------------------------------------------

describe("getLibPaths (real R subprocess)", { timeout: 30_000 }, async () => {
  const rAvailable = await isExecutableAvailable("R");

  test.skipIf(!rAvailable)("returns non-empty array of absolute paths", () =>
    withTempDir(async (dir) => {
      const libPaths = await getLibPaths("R", dir);
      expect(libPaths.length).toBeGreaterThan(0);
      for (const p of libPaths) {
        // Absolute path: starts with / on Unix or drive letter on Windows
        // R on Windows may use forward slashes (C:/...) or backslashes (C:\...)
        expect(p).toMatch(/^(\/|[A-Z]:[/\\])/i);
      }
    }),
  );
});

// ---------------------------------------------------------------------------
// listAvailablePackages — queries CRAN via a real R subprocess
// ---------------------------------------------------------------------------

describe(
  "listAvailablePackages (real R + CRAN)",
  { timeout: 120_000 },
  async () => {
    const rAvailable = await isExecutableAvailable("R");

    test.skipIf(!rAvailable)(
      "returns packages from CRAN including jsonlite",
      () =>
        withTempDir(async (dir) => {
          const repos = [{ Name: "CRAN", URL: "https://cran.rstudio.com" }];
          const packages = await listAvailablePackages("R", dir, repos);

          expect(packages.length).toBeGreaterThan(0);
          for (const pkg of packages) {
            expect(pkg.name).toBeTruthy();
            expect(pkg.version).toBeTruthy();
            expect(pkg.repository).toBeTruthy();
          }

          // jsonlite is a well-known, stable CRAN package
          const jsonlite = packages.find((p) => p.name === "jsonlite");
          expect(jsonlite).toBeDefined();
          expect(jsonlite!.version).toMatch(/^\d+\.\d+/);
        }),
    );
  },
);

// ---------------------------------------------------------------------------
// readPackageDescription — reads from a real renv library
// ---------------------------------------------------------------------------

describe(
  "readPackageDescription (real renv library)",
  { timeout: 120_000 },
  async () => {
    const rAvailable = await isExecutableAvailable("R");
    const renvInstalled = rAvailable && (await isRenvAvailable());

    test.skipIf(!rAvailable || !renvInstalled)(
      "reads renv package DESCRIPTION from a real renv library",
      () =>
        withTempDir(async (dir) => {
          // Create a minimal R project that uses renv
          await writeFile(
            path.join(dir, "script.R"),
            "library(renv)\n",
            "utf-8",
          );

          // Initialize renv to populate the library
          await execFileAsync(
            "Rscript",
            [
              "--no-init-file",
              "-e",
              "renv::init(bare = FALSE, restart = FALSE, settings = list(use.cache = FALSE))",
            ],
            {
              cwd: dir,
              timeout: 120_000,
              env: {
                ...process.env,
                RENV_CONFIG_AUTOLOADER_ENABLED: "FALSE",
              },
            },
          );

          // Get the library paths for this project
          const libPaths = await getLibPaths("R", dir);

          // renv itself should be installed in the project library
          const desc = await readPackageDescription("renv", libPaths);
          expect(desc["Package"]).toBe("renv");
          expect(desc["Version"]).toMatch(/^\d+\.\d+\.\d+/);
        }),
    );
  },
);

// ---------------------------------------------------------------------------
// libraryToManifestPackages — end-to-end with real R + renv
// ---------------------------------------------------------------------------

describe(
  "libraryToManifestPackages end-to-end",
  { timeout: 180_000 },
  async () => {
    const rAvailable = await isExecutableAvailable("R");
    const renvInstalled = rAvailable && (await isRenvAvailable());

    test.skipIf(!rAvailable || !renvInstalled)(
      "produces manifest packages for a project with jsonlite",
      () =>
        withTempDir(async (dir) => {
          // Create a project that uses jsonlite
          await writeFile(
            path.join(dir, "script.R"),
            "library(jsonlite)\n",
            "utf-8",
          );

          // Initialize renv to create lockfile + library
          await execFileAsync(
            "Rscript",
            [
              "--no-init-file",
              "-e",
              "renv::init(bare = FALSE, restart = FALSE, settings = list(use.cache = FALSE))",
            ],
            {
              cwd: dir,
              timeout: 120_000,
              env: {
                ...process.env,
                RENV_CONFIG_AUTOLOADER_ENABLED: "FALSE",
              },
            },
          );

          // Read back the lockfile to construct an rConfig
          const lockfileContent = await readFile(
            path.join(dir, "renv.lock"),
            "utf-8",
          );
          const lockfile = JSON.parse(lockfileContent);
          expect(lockfile.Packages["jsonlite"]).toBeDefined();

          const rConfig = {
            version: lockfile.R.Version,
            packageFile: "renv.lock",
            packageManager: "renv",
            packagesFromLibrary: true,
          };

          const result = await libraryToManifestPackages(dir, rConfig, "R");

          // jsonlite should be in the result
          expect(result["jsonlite"]).toBeDefined();
          // Source may be "CRAN", "RSPM", "PPM", or "P3M" depending on
          // the CI environment's configured repos — all are CRAN-like mirrors.
          expect(result["jsonlite"]!.Source).toMatch(/^(CRAN|RSPM|PPM|P3M)$/);
          expect(result["jsonlite"]!.Repository).toBeTruthy();
          expect(result["jsonlite"]!.description["Version"]).toMatch(
            /^\d+\.\d+/,
          );
        }),
    );
  },
);

// ---------------------------------------------------------------------------
// Error cases — no R needed
// ---------------------------------------------------------------------------

describe("libraryToManifestPackages error cases", () => {
  const rConfig = {
    version: "4.3.0",
    packageFile: "renv.lock",
    packageManager: "renv",
    packagesFromLibrary: true,
  };

  function makeLister(overrides: Partial<PackageLister> = {}): PackageLister {
    return {
      getLibPaths: () => Promise.resolve([]),
      listAvailablePackages: () => Promise.resolve([]),
      getBioconductorRepos: () => Promise.resolve([]),
      ...overrides,
    };
  }

  test("throws ENOENT when lockfile does not exist", async () => {
    await withTempDir(async (dir) => {
      await expect(
        libraryToManifestPackages(dir, rConfig, "R", makeLister()),
      ).rejects.toThrow(/ENOENT/);
    });
  });

  test("throws when lockfile is missing Repositories section", async () => {
    await withTempDir(async (dir) => {
      // Write a lockfile with no Repositories
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify({ R: { Version: "4.3.0" }, Packages: {} }),
        "utf-8",
      );

      await expect(
        libraryToManifestPackages(dir, rConfig, "R", makeLister()),
      ).rejects.toThrow("missing Repositories section");
    });
  });

  test("throws on version mismatch between lockfile and library", async () => {
    await withTempDir(async (dir) => {
      // Create a lockfile listing a package at version 1.0.0
      const lockfile = {
        R: {
          Version: "4.3.0",
          Repositories: [{ Name: "CRAN", URL: "https://cran.rstudio.com" }],
        },
        Packages: {
          mypkg: {
            Package: "mypkg",
            Version: "1.0.0",
            Source: "Repository",
            Repository: "CRAN",
          },
        },
      };
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify(lockfile),
        "utf-8",
      );

      // Create a DESCRIPTION with a different version
      const libDir = path.join(dir, "lib", "mypkg");
      await mkdir(libDir, { recursive: true });
      await writeFile(
        path.join(libDir, "DESCRIPTION"),
        "Package: mypkg\nVersion: 2.0.0\nTitle: Test\n",
        "utf-8",
      );

      const lister = makeLister({
        getLibPaths: () => Promise.resolve([path.join(dir, "lib")]),
        listAvailablePackages: () =>
          Promise.resolve([
            {
              name: "mypkg",
              version: "1.0.0",
              repository: "https://cran.rstudio.com",
            },
          ]),
      });

      await expect(
        libraryToManifestPackages(dir, rConfig, "R", lister),
      ).rejects.toThrow(
        "versions in lockfile '1.0.0' and library '2.0.0' are out of sync",
      );
    });
  });

  test("throws when a lockfile package is missing from the library", async () => {
    await withTempDir(async (dir) => {
      // Create a lockfile with two packages, but only install one in the library
      const lockfile = {
        R: {
          Version: "4.3.0",
          Repositories: [{ Name: "CRAN", URL: "https://cran.rstudio.com" }],
        },
        Packages: {
          installed: {
            Package: "installed",
            Version: "1.0.0",
            Source: "Repository",
            Repository: "CRAN",
          },
          missing: {
            Package: "missing",
            Version: "2.0.0",
            Source: "Repository",
            Repository: "CRAN",
          },
        },
      };
      await writeFile(
        path.join(dir, "renv.lock"),
        JSON.stringify(lockfile),
        "utf-8",
      );

      // Only create the "installed" package in the library; "missing" has no DESCRIPTION
      const installedDir = path.join(dir, "lib", "installed");
      await mkdir(installedDir, { recursive: true });
      await writeFile(
        path.join(installedDir, "DESCRIPTION"),
        "Package: installed\nVersion: 1.0.0\nTitle: Installed Package\n",
        "utf-8",
      );

      const lister = makeLister({
        getLibPaths: () => Promise.resolve([path.join(dir, "lib")]),
        listAvailablePackages: () =>
          Promise.resolve([
            {
              name: "installed",
              version: "1.0.0",
              repository: "https://cran.rstudio.com",
            },
            {
              name: "missing",
              version: "2.0.0",
              repository: "https://cran.rstudio.com",
            },
          ]),
      });

      await expect(
        libraryToManifestPackages(dir, rConfig, "R", lister),
      ).rejects.toThrow(/missing.*renv::restore\(\)/);
    });
  });
});
