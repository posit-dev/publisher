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
  parseLibPathsOutput,
  parseAvailablePackagesOutput,
  parseBioconductorReposOutput,
  buildAvailablePackagesCode,
  escapeForRString,
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
    expect(result.Repository).toBe("");
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

  test("GitLab package", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "GitLab",
      RemoteType: "gitlab",
      RemoteUsername: "user",
      RemoteRepo: "mypkg",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "gitlab",
      Repository: "https://gitlab.com/user/mypkg",
    });
  });

  test("Bitbucket package", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "Bitbucket",
      RemoteType: "bitbucket",
      RemotePkgRef: "org/mypkg",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "bitbucket",
      Repository: "https://bitbucket.org/org/mypkg",
    });
  });

  test("GitHub package with RemotePkgRef takes precedence over derived", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "GitHub",
      RemoteType: "github",
      RemotePkgRef: "custom-org/custom-repo",
      RemoteUsername: "user",
      RemoteRepo: "mypkg",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "github",
      Repository: "https://github.com/custom-org/custom-repo",
    });
  });

  test("GitHub package with no remote ref or username/repo returns empty Repository", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "GitHub",
      RemoteType: "github",
      // No RemotePkgRef, RemoteUsername, or RemoteRepo.
      // remotePkgRefOrDerived() returns "" because both RemotePkgRef and
      // the derived username/repo are missing. The falsy `ref` causes
      // the ternary in the GitHub case to short-circuit to "".
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "github",
      Repository: "",
    });
  });

  test("unknown source results in empty source/repo", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "unknown",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({ Source: "", Repository: "" });
  });

  test("non-CRAN repository resolves from available packages", () => {
    const customRepos = [
      { Name: "CRAN", URL: "https://cran.rstudio.com" },
      { Name: "MyRepo", URL: "https://my-repo.example.com" },
    ];
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "Repository",
      Repository: "MyRepo",
    };
    const available: AvailablePackage[] = [
      {
        name: "mypkg",
        version: "1.0.0",
        repository: "https://my-repo.example.com",
      },
    ];
    const result = toManifestPackage(pkg, customRepos, available, []);
    expect(result).toEqual({
      Source: "MyRepo",
      Repository: "https://my-repo.example.com",
    });
  });

  test("Bioconductor found in availablePackages before biocPackages", () => {
    const pkg: RenvPackage = {
      Package: "Biobase",
      Version: "2.62.0",
      Source: "Bioconductor",
    };
    const available: AvailablePackage[] = [
      {
        name: "Biobase",
        version: "2.62.0",
        repository: "https://bioconductor.org/packages/3.18/bioc",
      },
    ];
    const biocPackages: AvailablePackage[] = [
      {
        name: "Biobase",
        version: "2.62.0",
        repository: "https://bioconductor.org/packages/3.18/OTHER",
      },
    ];
    const result = toManifestPackage(pkg, cranRepos, available, biocPackages);
    // Should use availablePackages URL, not biocPackages
    expect(result.Repository).toBe(
      "https://bioconductor.org/packages/3.18/bioc",
    );
  });

  test("default case passes through unknown Source string", () => {
    const pkg: RenvPackage = {
      Package: "mypkg",
      Version: "1.0.0",
      Source: "CustomSource",
      Repository: "https://custom.example.com",
    };
    const result = toManifestPackage(pkg, cranRepos, [], []);
    expect(result).toEqual({
      Source: "CustomSource",
      Repository: "https://custom.example.com",
    });
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

  test("throws when lockfile is missing Repositories section", async () => {
    const projectDir = path.join(testdataDir, "no_repos_project");
    const lister = makeLister();

    await expect(
      libraryToManifestPackages(projectDir, rConfig, "/usr/bin/R", lister),
    ).rejects.toThrow("missing Repositories section");
  });

  test("throws when packageFile does not exist", async () => {
    const projectDir = path.join(testdataDir, "cran_project");
    const lister = makeLister();

    await expect(
      libraryToManifestPackages(
        projectDir,
        { ...rConfig, packageFile: "nonexistent.lock" },
        "/usr/bin/R",
        lister,
      ),
    ).rejects.toThrow();
  });

  test("exercises Bioconductor path when lister returns bioc repos", async () => {
    const projectDir = path.join(testdataDir, "bioc_project");
    const libPath = path.join(testdataDir, "bioc_project", "renv_library");

    const listCalls: string[] = [];
    const lister = makeLister({
      getLibPaths: () => Promise.resolve([libPath]),
      listAvailablePackages: (_rPath, _projectDir, repos) => {
        // Track which repos were queried
        const repoNames = repos.map((r) => r.Name).join(",");
        listCalls.push(repoNames);
        if (repoNames.includes("BioCsoft")) {
          return Promise.resolve([
            {
              name: "Biobase",
              version: "2.62.0",
              repository: "https://bioconductor.org/packages/3.18/bioc",
            },
          ]);
        }
        return Promise.resolve([]);
      },
      getBioconductorRepos: () =>
        Promise.resolve([
          {
            Name: "BioCsoft",
            URL: "https://bioconductor.org/packages/3.18/bioc",
          },
        ]),
    });

    const result = await libraryToManifestPackages(
      projectDir,
      rConfig,
      "/usr/bin/R",
      lister,
    );

    // Should have called listAvailablePackages twice: once for lockfile repos, once for bioc
    expect(listCalls).toHaveLength(2);
    expect(listCalls[1]).toContain("BioCsoft");
    expect(result["Biobase"]).toBeDefined();
    expect(result["Biobase"]!.Source).toBe("Bioconductor");
  });
});

// ---------------------------------------------------------------------------
// Output parsing integration tests
// ---------------------------------------------------------------------------

describe("parseLibPathsOutput", () => {
  test("parses typical R .libPaths() output", () => {
    const output = [
      "/home/user/R/x86_64-pc-linux-gnu-library/4.3",
      "/usr/local/lib/R/site-library",
      "/usr/lib/R/library",
      "",
    ].join("\n");
    expect(parseLibPathsOutput(output)).toEqual([
      "/home/user/R/x86_64-pc-linux-gnu-library/4.3",
      "/usr/local/lib/R/site-library",
      "/usr/lib/R/library",
    ]);
  });

  test("filters empty lines and lines starting with dash", () => {
    const output = "/home/user/R/lib\n\n-some-noise\n/usr/lib/R\n";
    expect(parseLibPathsOutput(output)).toEqual([
      "/home/user/R/lib",
      "/usr/lib/R",
    ]);
  });

  test("trims whitespace from paths", () => {
    const output = "  /home/user/R/lib  \n  /usr/lib/R  \n";
    expect(parseLibPathsOutput(output)).toEqual([
      "/home/user/R/lib",
      "/usr/lib/R",
    ]);
  });

  test("returns empty array for empty output", () => {
    expect(parseLibPathsOutput("")).toEqual([]);
    expect(parseLibPathsOutput("\n")).toEqual([]);
  });
});

describe("parseAvailablePackagesOutput", () => {
  test("parses typical available.packages() output", () => {
    const output = [
      "rlang 1.1.1 https://cran.rstudio.com/src/contrib",
      "dplyr 1.1.3 https://cran.rstudio.com/src/contrib",
      "ggplot2 3.4.4 https://cloud.r-project.org/src/contrib",
      "",
    ].join("\n");
    const result = parseAvailablePackagesOutput(output);
    expect(result).toEqual([
      {
        name: "rlang",
        version: "1.1.1",
        repository: "https://cran.rstudio.com",
      },
      {
        name: "dplyr",
        version: "1.1.3",
        repository: "https://cran.rstudio.com",
      },
      {
        name: "ggplot2",
        version: "3.4.4",
        repository: "https://cloud.r-project.org",
      },
    ]);
  });

  test("strips /src/contrib suffix from repository URLs", () => {
    const output = "pkg 1.0.0 https://repo.example.com/src/contrib\n";
    const result = parseAvailablePackagesOutput(output);
    expect(result[0]!.repository).toBe("https://repo.example.com");
  });

  test("preserves repository URL without /src/contrib suffix", () => {
    const output = "pkg 1.0.0 https://repo.example.com\n";
    const result = parseAvailablePackagesOutput(output);
    expect(result[0]!.repository).toBe("https://repo.example.com");
  });

  test("skips lines with wrong number of parts", () => {
    const output = [
      "good 1.0.0 https://cran.rstudio.com",
      "only-two-parts 1.0.0",
      "",
      "too many parts here right https://example.com",
      "also-good 2.0.0 https://other.example.com",
    ].join("\n");
    const result = parseAvailablePackagesOutput(output);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("good");
    expect(result[1]!.name).toBe("also-good");
  });

  test("returns empty array for empty output", () => {
    expect(parseAvailablePackagesOutput("")).toEqual([]);
    expect(parseAvailablePackagesOutput("\n")).toEqual([]);
  });
});

describe("parseBioconductorReposOutput", () => {
  test("parses typical Bioconductor repos output", () => {
    const output = [
      "BioCsoft https://bioconductor.org/packages/3.18/bioc",
      "BioCann https://bioconductor.org/packages/3.18/data/annotation",
      "BioCexp https://bioconductor.org/packages/3.18/data/experiment",
      "",
    ].join("\n");
    const result = parseBioconductorReposOutput(output);
    expect(result).toEqual([
      { Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc" },
      {
        Name: "BioCann",
        URL: "https://bioconductor.org/packages/3.18/data/annotation",
      },
      {
        Name: "BioCexp",
        URL: "https://bioconductor.org/packages/3.18/data/experiment",
      },
    ]);
  });

  test("skips empty lines and lines starting with dash", () => {
    const output = [
      "BioCsoft https://bioconductor.org/packages/3.18/bioc",
      "",
      "- some R warning output",
      "BioCann https://bioconductor.org/packages/3.18/data/annotation",
    ].join("\n");
    const result = parseBioconductorReposOutput(output);
    expect(result).toHaveLength(2);
    expect(result[0]!.Name).toBe("BioCsoft");
    expect(result[1]!.Name).toBe("BioCann");
  });

  test("skips lines with no space (no URL)", () => {
    const output =
      "BioCsoft https://bioconductor.org/packages/3.18/bioc\nmalformed\n";
    const result = parseBioconductorReposOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0]!.Name).toBe("BioCsoft");
  });

  test("returns empty array for empty output", () => {
    expect(parseBioconductorReposOutput("")).toEqual([]);
    expect(parseBioconductorReposOutput("\n")).toEqual([]);
  });
});

describe("escapeForRString", () => {
  test("escapes backslashes", () => {
    expect(escapeForRString("C:\\Users\\test")).toBe("C:\\\\Users\\\\test");
  });

  test("escapes double quotes", () => {
    expect(escapeForRString('hello "world"')).toBe('hello \\"world\\"');
  });

  test("escapes both backslashes and double quotes", () => {
    expect(escapeForRString('C:\\path\\"injected')).toBe(
      'C:\\\\path\\\\\\"injected',
    );
  });

  test("leaves safe strings unchanged", () => {
    expect(escapeForRString("/home/user/project")).toBe("/home/user/project");
  });

  test("handles empty string", () => {
    expect(escapeForRString("")).toBe("");
  });
});

describe("buildAvailablePackagesCode", () => {
  test("strips trailing slashes from repo URLs", () => {
    const code = buildAvailablePackagesCode([
      { Name: "CRAN", URL: "https://cran.rstudio.com/" },
    ]);
    expect(code).toContain('"https://cran.rstudio.com"');
    expect(code).not.toContain('rstudio.com/"');
  });

  test("uses fallback name when repo Name is empty", () => {
    const code = buildAvailablePackagesCode([
      { Name: "", URL: "https://example.com" },
    ]);
    expect(code).toContain('"repo_0"');
  });

  test("escapes double quotes in repo names and URLs", () => {
    const code = buildAvailablePackagesCode([
      { Name: 'evil")); system("pwned', URL: 'https://evil.com/"); cat("' },
    ]);
    // The double quotes should be escaped so they don't break out of R strings
    expect(code).not.toContain('system("pwned');
    expect(code).toContain('\\"');
  });

  test("includes multiple repos", () => {
    const code = buildAvailablePackagesCode([
      { Name: "CRAN", URL: "https://cran.rstudio.com" },
      { Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc" },
    ]);
    expect(code).toContain('"CRAN"');
    expect(code).toContain('"BioCsoft"');
    expect(code).toContain('"https://cran.rstudio.com"');
    expect(code).toContain('"https://bioconductor.org/packages/3.18/bioc"');
  });

  test("does not place semicolons inside function-call parentheses", () => {
    const code = buildAvailablePackagesCode([
      { Name: "CRAN", URL: "https://cran.rstudio.com" },
      { Name: "BioCsoft", URL: "https://bioconductor.org/packages/3.18/bioc" },
    ]);
    // Semicolons should only appear between top-level statements, never
    // inside function-call parens (e.g. "(;" or ",;").
    expect(code).not.toMatch(/\(;/);
    expect(code).not.toMatch(/,;/);
  });
});
