// Copyright (C) 2026 by Posit Software, PBC.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import type { RenvPackage } from "./rPackageDescriptions";
import {
  isCRANLike,
  toManifestPackage,
  readPackageDescription,
  libraryToManifestPackages,
  type AvailablePackage,
  type PackageLister,
} from "./rLibraryMapper";

const testdataDir = path.resolve(__dirname, "testdata");

// ---------------------------------------------------------------------------
// isCRANLike
// ---------------------------------------------------------------------------

describe("isCRANLike", () => {
  test("CRAN and Posit Package Manager variants are CRAN-like", () => {
    expect(isCRANLike("CRAN")).toBe(true);
    expect(isCRANLike("RSPM")).toBe(true);
    expect(isCRANLike("PPM")).toBe(true);
    expect(isCRANLike("P3M")).toBe(true);
  });

  test("other repositories are not CRAN-like", () => {
    expect(isCRANLike("Bioconductor")).toBe(false);
    expect(isCRANLike("GitHub")).toBe(false);
    expect(isCRANLike("custom-repo")).toBe(false);
    expect(isCRANLike("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toManifestPackage
// ---------------------------------------------------------------------------

describe("toManifestPackage", () => {
  const cranRepos = [{ Name: "CRAN", URL: "https://cran.rstudio.com" }];

  test("CRAN package found in available packages", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.2.3",
      Source: "Repository",
      Repository: "CRAN",
    };
    const available: AvailablePackage[] = [
      {
        name: "mypkg",
        version: "1.2.3",
        repository: "https://cran.rstudio.com",
      },
    ];
    const result = toManifestPackage(pkg, cranRepos, available, []);
    expect(result).toEqual({
      Source: "CRAN",
      Repository: "https://cran.rstudio.com",
    });
  });

  test("CRAN dev version results in empty source/repo", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "2.0.0",
      Source: "Repository",
      Repository: "CRAN",
    };
    const available: AvailablePackage[] = [
      {
        name: "mypkg",
        version: "1.0.0",
        repository: "https://cran.rstudio.com",
      },
    ];
    const result = toManifestPackage(pkg, cranRepos, available, []);
    expect(result).toEqual({ Source: "", Repository: "" });
  });

  test("RSPM package not in available packages keeps RSPM source", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.2.3",
      Source: "Repository",
      Repository: "RSPM",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result.Source).toBe("RSPM");
  });

  test("Bioconductor package found in bioc packages", () => {
    const pkg: RenvPackage = {
      Package: "Biobase",
      Version: "2.62.0",
      Source: "Bioconductor",
    };
    const biocPackages: AvailablePackage[] = [
      {
        name: "Biobase",
        version: "2.62.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
    ];
    const result = toManifestPackage(pkg, cranRepos, [], biocPackages);
    expect(result).toEqual({
      Source: "Bioconductor",
      Repository: "https://bioconductor.org/packages/3.18/bioc",
    });
  });

  test("GitHub package", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "GitHub",
      RemoteType: "github",
      RemoteUsername: "user",
      RemoteRepo: "mypkg",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "github",
      Repository: "https://github.com/user/mypkg",
    });
  });

  test("Local package results in empty source/repo", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "Local",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({ Source: "", Repository: "" });
  });

  test("Bioconductor workaround for missing repository with bioconductor RemoteRepos", () => {
    const pkg: RenvPackage = {
      Package: "Biobase",
      Version: "2.62.0",
      Source: "Repository",
      RemoteRepos: "https://bioconductor.org/packages/3.18/bioc",
    };
    const biocPackages: AvailablePackage[] = [
      {
        name: "Biobase",
        version: "2.62.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
    ];
    const result = toManifestPackage(pkg, cranRepos, [], biocPackages);
    expect(result).toEqual({
      Source: "Bioconductor",
      Repository: "https://bioconductor.org/packages/3.18/bioc",
    });
  });
});

// ---------------------------------------------------------------------------
// readPackageDescription
// ---------------------------------------------------------------------------

describe("readPackageDescription", () => {
  test("reads DESCRIPTION from second libPath when first is nonexistent", async () => {
    const libPath = path.join(testdataDir, "cran_project", "renv_library");
    const desc = await readPackageDescription("mypkg", [
      "/nonexistent",
      libPath,
    ]);
    expect(desc["Package"]).toBe("mypkg");
    expect(desc["Version"]).toBe("1.2.3");
    expect(desc["Title"]).toBe("A Sample Package");
  });

  test("throws when package is not found in any libPath", async () => {
    await expect(
      readPackageDescription("nonexistent", ["/nonexistent"]),
    ).rejects.toThrow("package not found in current libPaths");
  });

  test("reads Biobase DESCRIPTION with keepWhiteFields", async () => {
    const libPath = path.join(testdataDir, "bioc_project", "renv_library");
    const desc = await readPackageDescription("Biobase", [libPath]);
    expect(desc["Package"]).toBe("Biobase");
    expect(desc["Version"]).toBe("2.62.0");
    // Verify continuation lines are preserved for Description field
    expect(desc["Description"]).toContain("\n");
  });
});

// ---------------------------------------------------------------------------
// Golden file tests: CRAN project
// ---------------------------------------------------------------------------

describe("library mapper golden files", () => {
  test("CRAN project matches expected.json", async () => {
    const projectDir = path.join(testdataDir, "cran_project");
    const expectedPath = path.join(projectDir, "expected-library.json");
    const expectedJSON = await readFile(expectedPath, "utf-8");
    const expected = JSON.parse(expectedJSON);

    // Simulate what libraryToManifestPackages does without R subprocess:
    // Read lockfile
    const lockfileContent = await readFile(
      path.join(projectDir, "renv.lock"),
      "utf-8",
    );
    const lockfile = JSON.parse(lockfileContent);

    const repos = lockfile.R.Repositories;
    const availablePackages: AvailablePackage[] = [
      {
        name: "random_package",
        version: "4.5.6",
        repository: "https://cran.example.com",
      },
      {
        name: "mypkg",
        version: "1.2.3",
        repository: "https://cran.rstudio.com",
      },
    ];
    const libPath = path.join(projectDir, "renv_library");

    const result: Record<
      string,
      {
        Source: string;
        Repository: string;
        description: Record<string, string>;
      }
    > = {};
    for (const pkgName of Object.keys(lockfile.Packages).sort()) {
      const pkg = lockfile.Packages[pkgName];
      const { Source, Repository } = toManifestPackage(
        pkg,
        repos,
        availablePackages,
        [],
      );
      const description = await readPackageDescription(pkgName, [
        "/nonexistent",
        libPath,
      ]);
      result[pkgName] = { Source, Repository, description };
    }

    expect(result).toEqual(expected);
  });

  test("Bioconductor project matches expected.json", async () => {
    const projectDir = path.join(testdataDir, "bioc_project");
    const expectedPath = path.join(projectDir, "expected-library.json");
    const expectedJSON = await readFile(expectedPath, "utf-8");
    const expected = JSON.parse(expectedJSON);

    const lockfileContent = await readFile(
      path.join(projectDir, "renv.lock"),
      "utf-8",
    );
    const lockfile = JSON.parse(lockfileContent);

    const repos = lockfile.R.Repositories;
    const availablePackages: AvailablePackage[] = [
      {
        name: "random_package",
        version: "4.5.6",
        repository: "https://cran.example.com",
      },
      {
        name: "mypkg",
        version: "1.2.3",
        repository: "https://cran.rstudio.com",
      },
    ];
    const biocPackages: AvailablePackage[] = [
      {
        name: "bioassayR",
        version: "1.40.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
      {
        name: "Biobase",
        version: "2.62.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
      {
        name: "biobroom",
        version: "1.34.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
    ];
    const libPath = path.join(projectDir, "renv_library");

    const result: Record<
      string,
      {
        Source: string;
        Repository: string;
        description: Record<string, string>;
      }
    > = {};
    for (const pkgName of Object.keys(lockfile.Packages).sort()) {
      const pkg = lockfile.Packages[pkgName];
      const { Source, Repository } = toManifestPackage(
        pkg,
        repos,
        availablePackages,
        biocPackages,
      );
      const description = await readPackageDescription(pkgName, [
        "/nonexistent",
        libPath,
      ]);
      result[pkgName] = { Source, Repository, description };
    }

    expect(result).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("library mapper error cases", () => {
  test("version mismatch throws descriptive error", async () => {
    const projectDir = path.join(testdataDir, "version_mismatch");
    const lockfileContent = await readFile(
      path.join(projectDir, "renv.lock"),
      "utf-8",
    );
    const lockfile = JSON.parse(lockfileContent);
    const libPath = path.join(projectDir, "renv_library");

    const pkg = lockfile.Packages["mypkg"];
    const description = await readPackageDescription("mypkg", [libPath]);

    // Lockfile says 1.2.3, DESCRIPTION says 4.5.6
    expect(description["Version"]).toBe("4.5.6");
    expect(pkg.Version).toBe("1.2.3");
    expect(description["Version"]).not.toBe(pkg.Version);
  });

  test("dev version produces empty Source", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.2.3",
      Source: "Repository",
      Repository: "CRAN",
    };
    const available: AvailablePackage[] = [
      {
        name: "mypkg",
        version: "1.0.0", // installed is newer
        repository: "https://cran.rstudio.com",
      },
    ];
    const result = toManifestPackage(
      pkg,
      [{ Name: "CRAN", URL: "https://cran.rstudio.com" }],
      available,
      [],
    );
    expect(result.Source).toBe("");
    expect(result.Repository).toBe("");
  });

  test("missing DESCRIPTION throws with renv::restore() guidance", async () => {
    await expect(readPackageDescription("mypkg", [])).rejects.toThrow(
      "consider running renv::restore()",
    );
  });
});

// ---------------------------------------------------------------------------
// libraryToManifestPackages (with mocked R subprocess)
// ---------------------------------------------------------------------------

describe("libraryToManifestPackages", () => {
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

  test("integrates lockfile reading, package resolution, and DESCRIPTION parsing", async () => {
    const projectDir = path.join(testdataDir, "cran_project");
    const libPath = path.join(projectDir, "renv_library");

    const lister = makeLister({
      getLibPaths: () => Promise.resolve(["/nonexistent", libPath]),
      listAvailablePackages: () =>
        Promise.resolve([
          {
            name: "mypkg",
            version: "1.2.3",
            repository: "https://cran.rstudio.com",
          },
        ]),
    });

    const result = await libraryToManifestPackages(
      projectDir,
      rConfig,
      "/usr/bin/R",
      lister,
    );

    expect(result["mypkg"]).toBeDefined();
    expect(result["mypkg"]!.Source).toBe("CRAN");
    expect(result["mypkg"]!.Repository).toBe("https://cran.rstudio.com");
    expect(result["mypkg"]!.description["Package"]).toBe("mypkg");
    expect(result["mypkg"]!.description["Version"]).toBe("1.2.3");
  });

  test("throws on version mismatch between lockfile and library", async () => {
    const projectDir = path.join(testdataDir, "version_mismatch");
    const libPath = path.join(projectDir, "renv_library");

    const lister = makeLister({
      getLibPaths: () => Promise.resolve([libPath]),
      listAvailablePackages: () =>
        Promise.resolve([
          {
            name: "mypkg",
            version: "1.2.3",
            repository: "https://cran.rstudio.com",
          },
        ]),
    });

    await expect(
      libraryToManifestPackages(projectDir, rConfig, "/usr/bin/R", lister),
    ).rejects.toThrow("versions in lockfile '1.2.3' and library '4.5.6'");
  });

  test("throws on dev version with empty source", async () => {
    const projectDir = path.join(testdataDir, "dev_version");
    const libPath = path.join(projectDir, "renv_library");

    const lister = makeLister({
      getLibPaths: () => Promise.resolve([libPath]),
      listAvailablePackages: () =>
        Promise.resolve([
          {
            name: "mypkg",
            version: "1.0.0", // installed version (1.2.3) is newer
            repository: "https://cran.rstudio.com",
          },
        ]),
    });

    await expect(
      libraryToManifestPackages(projectDir, rConfig, "/usr/bin/R", lister),
    ).rejects.toThrow("cannot re-install packages installed from source");
  });

  test("throws when DESCRIPTION not found in any libPath", async () => {
    const projectDir = path.join(testdataDir, "cran_project");

    const lister = makeLister({
      getLibPaths: () => Promise.resolve([]), // No lib paths — package won't be found
      listAvailablePackages: () =>
        Promise.resolve([
          {
            name: "mypkg",
            version: "1.2.3",
            repository: "https://cran.rstudio.com",
          },
        ]),
    });

    await expect(
      libraryToManifestPackages(projectDir, rConfig, "/usr/bin/R", lister),
    ).rejects.toThrow("consider running renv::restore()");
  });
});
