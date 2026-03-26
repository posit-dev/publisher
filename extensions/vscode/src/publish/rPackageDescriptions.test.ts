// Copyright (C) 2026 by Posit Software, PBC.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ManifestPackage } from "../bundler/types";
import {
  findAllRepositories,
  lockfileToManifestPackages,
  resolveRepoAndSource,
  type RenvLockfile,
} from "./rPackageDescriptions";

const testdataDir = path.resolve(__dirname, "testdata");

async function loadFixture(project: string): Promise<{
  lockfile: RenvLockfile;
  expected: Record<string, ManifestPackage>;
}> {
  const dir = path.join(testdataDir, project);
  const [lockfileJSON, expectedJSON] = await Promise.all([
    readFile(path.join(dir, "renv.lock"), "utf-8"),
    readFile(path.join(dir, "expected.json"), "utf-8"),
  ]);
  return {
    lockfile: JSON.parse(lockfileJSON),
    expected: JSON.parse(expectedJSON),
  };
}

/** Look up a package in the result, failing the test if missing. */
function getPackage(
  result: Record<string, ManifestPackage>,
  name: string,
): ManifestPackage {
  const pkg = result[name];
  expect(pkg, `expected package "${name}" to be present`).toBeDefined();
  return pkg!;
}

/**
 * Assert that `actual` matches `expected` on all fields present in expected.
 * The actual output may have additional fields, which is fine.
 */
function assertPackageMatches(
  pkgName: string,
  expected: ManifestPackage,
  actual: ManifestPackage,
) {
  expect(actual.Source, `Source mismatch for ${pkgName}`).toBe(expected.Source);
  expect(actual.Repository, `Repository mismatch for ${pkgName}`).toBe(
    expected.Repository,
  );
  for (const [key, value] of Object.entries(expected.description)) {
    // Go maps can't distinguish absent from empty string; treat "" as equivalent to undefined
    if (value === "") {
      expect(
        actual.description[key] ?? "",
        `description.${key} mismatch for ${pkgName}`,
      ).toBe("");
    } else {
      expect(
        actual.description[key],
        `description.${key} mismatch for ${pkgName}`,
      ).toBe(value);
    }
  }
}

// ---- Fixture-based tests ----

describe("lockfileToManifestPackages", () => {
  test("CRAN project", async () => {
    const { lockfile, expected } = await loadFixture("cran_project");
    const result = lockfileToManifestPackages(lockfile);

    for (const [pkgName, expectedPkg] of Object.entries(expected)) {
      assertPackageMatches(pkgName, expectedPkg, getPackage(result, pkgName));
    }
  });

  test("Bioconductor project", async () => {
    const { lockfile, expected } = await loadFixture("bioc_project");
    const result = lockfileToManifestPackages(lockfile);

    for (const [pkgName, expectedPkg] of Object.entries(expected)) {
      assertPackageMatches(pkgName, expectedPkg, getPackage(result, pkgName));
    }
  });

  test("sample project (78-package golden file from Go)", async () => {
    const { lockfile, expected } = await loadFixture("sample_project");
    const result = lockfileToManifestPackages(lockfile);

    expect(Object.keys(result).length).toBe(Object.keys(expected).length);
    for (const [pkgName, expectedPkg] of Object.entries(expected)) {
      assertPackageMatches(pkgName, expectedPkg, getPackage(result, pkgName));
    }
  });

  test("RSPM with RemoteRepos", () => {
    const lockfile: RenvLockfile = {
      R: {
        Version: "4.3.3",
        Repositories: [
          { Name: "CRAN", URL: "https://cloud.r-project.org" },
          { Name: "turbopackages", URL: "https://turbopackages.org/latest" },
        ],
      },
      Packages: {
        R6: {
          Package: "R6",
          Version: "2.5.1",
          Source: "Repository",
          Repository: "RSPM",
          RemoteType: "standard",
          RemotePkgRef: "R6",
          RemoteRef: "R6",
          RemoteRepos: "https://packagemanager.rstudio.com/all/latest",
          RemoteReposName: "CRAN",
          RemotePkgPlatform: "x86_64-apple-darwin20",
          RemoteSha: "2.5.1",
          Requirements: ["R"],
          Hash: "470851b6d5d0ac559e9d01bb352b4021",
        },
        turbobear: {
          Package: "turbobear",
          Version: "99.99.99",
          Source: "Repository",
          RemoteType: "standard",
          RemotePkgRef: "turbobear",
          RemoteRef: "turbobear",
          RemoteRepos: "turbopackages",
          RemoteReposName: "turbopackages",
          RemotePkgPlatform: "x86_64-apple-darwin20",
          RemoteSha: "99.99.99",
          Requirements: ["R"],
          Hash: "990851b6d5d0ac559e9d01bb352b4021",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);

    const r6 = getPackage(result, "R6");
    expect(r6.Source).toBe("RSPM");
    expect(r6.Repository).toBe("https://packagemanager.rstudio.com/all/latest");
    expect(r6.description["Version"]).toBe("2.5.1");

    const turbobear = getPackage(result, "turbobear");
    expect(turbobear.Source).toBe("turbopackages");
    expect(turbobear.Repository).toBe("https://turbopackages.org/latest");
    expect(turbobear.description["Version"]).toBe("99.99.99");
  });

  test("RSPM without RemoteRepos falls back to default", () => {
    const lockfile: RenvLockfile = {
      R: {
        Version: "4.3.3",
        Repositories: [{ Name: "CRAN", URL: "https://cloud.r-project.org" }],
      },
      Packages: {
        renv: {
          Package: "renv",
          Version: "0.17.3",
          Source: "Repository",
          Repository: "RSPM",
          Requirements: ["utils"],
          Hash: "4543b8cd233ae25c6aba8548be9e747e",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const renvPkg = getPackage(result, "renv");
    expect(renvPkg.Source).toBe("RSPM");
    expect(renvPkg.Repository).toBe(
      "https://packagemanager.posit.co/cran/latest",
    );
  });

  test("GitHub remote package", () => {
    const lockfile: RenvLockfile = {
      R: {
        Version: "4.3.3",
        Repositories: [],
      },
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "1.2.3",
          Source: "GitHub",
          RemoteType: "github",
          RemoteHost: "api.github.com",
          RemoteRepo: "mypkg",
          RemoteUsername: "posit-dev",
          RemoteRef: "main",
          RemoteSha: "abcdef1234567890",
          RemoteUrl: "https://api.github.com/repos/posit-dev/mypkg",
          Requirements: [],
          Hash: "0123456789abcdef",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const pkg = getPackage(result, "mypkg");

    expect(pkg.Source).toBe("github");
    expect(pkg.Repository).toBe("https://github.com/posit-dev/mypkg");

    expect(pkg.description["RemotePkgRef"]).toBe("posit-dev/mypkg");
    expect(pkg.description["RemoteHost"]).toBe("api.github.com");
    expect(pkg.description["RemoteRepo"]).toBe("mypkg");
    expect(pkg.description["RemoteUsername"]).toBe("posit-dev");
    expect(pkg.description["RemoteUrl"]).toBe(
      "https://api.github.com/repos/posit-dev/mypkg",
    );
    expect(pkg.description["RemoteSha"]).toBe("abcdef1234567890");
    // URL/BugReports are only set when RemotePkgRef is explicit in the lockfile.
    // Here it's derived from RemoteUsername/RemoteRepo, so they won't be set.
    expect(pkg.description["URL"]).toBeUndefined();
    expect(pkg.description["BugReports"]).toBeUndefined();
  });

  test("GitHub remote with explicit RemotePkgRef sets URL/BugReports", () => {
    const lockfile: RenvLockfile = {
      R: { Version: "4.3.3", Repositories: [] },
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "1.0.0",
          Source: "GitHub",
          RemoteType: "github",
          RemotePkgRef: "posit-dev/mypkg",
          RemoteUsername: "posit-dev",
          RemoteRepo: "mypkg",
          RemoteRef: "main",
          RemoteSha: "abc123",
          RemoteUrl: "https://api.github.com/repos/posit-dev/mypkg",
          Hash: "deadbeef",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const pkg = getPackage(result, "mypkg");
    expect(pkg.description["URL"]).toBe("https://github.com/posit-dev/mypkg");
    expect(pkg.description["BugReports"]).toBe(
      "https://github.com/posit-dev/mypkg/issues",
    );
  });

  test("GitLab remote package", () => {
    const lockfile: RenvLockfile = {
      R: { Version: "4.3.3", Repositories: [] },
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "1.0.0",
          Source: "GitLab",
          RemoteType: "gitlab",
          RemoteUsername: "team",
          RemoteRepo: "mypkg",
          RemoteSha: "abc123",
          Hash: "deadbeef",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const pkg = getPackage(result, "mypkg");
    expect(pkg.Source).toBe("gitlab");
    expect(pkg.Repository).toBe("https://gitlab.com/team/mypkg");
  });

  test("Bitbucket remote package", () => {
    const lockfile: RenvLockfile = {
      R: { Version: "4.3.3", Repositories: [] },
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "1.0.0",
          Source: "Bitbucket",
          RemoteType: "bitbucket",
          RemoteUsername: "team",
          RemoteRepo: "mypkg",
          RemoteSha: "abc123",
          Hash: "deadbeef",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const pkg = getPackage(result, "mypkg");
    expect(pkg.Source).toBe("bitbucket");
    expect(pkg.Repository).toBe("https://bitbucket.org/team/mypkg");
  });

  test("hashing fields: Depends, Imports, Suggests, LinkingTo", () => {
    const lockfile: RenvLockfile = {
      R: {
        Version: "4.3.3",
        Repositories: [{ Name: "CRAN", URL: "https://cloud.r-project.org" }],
      },
      Packages: {
        mypkg: {
          Package: "mypkg",
          Version: "1.0.0",
          Source: "Repository",
          Repository: "CRAN",
          Depends: ["R (>= 3.5.0)", "foo", "bar"],
          Imports: ["glue", "stringr"],
          Suggests: ["knitr", "rmarkdown"],
          LinkingTo: ["Rcpp", "cpp11 (>= 0.5.0)"],
          Hash: "deadbeef",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    const desc = getPackage(result, "mypkg").description;

    expect(desc["Depends"]).toBe("R (>= 3.5.0), foo, bar");
    expect(desc["Imports"]).toBe("glue, stringr");
    expect(desc["Suggests"]).toBe("knitr, rmarkdown");
    expect(desc["LinkingTo"]).toBe("Rcpp, cpp11 (>= 0.5.0)");
  });

  test("Requirements used as Depends fallback", () => {
    const lockfile: RenvLockfile = {
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
          Requirements: ["R", "utils"],
          Hash: "abc123",
        },
      },
    };

    const result = lockfileToManifestPackages(lockfile);
    expect(getPackage(result, "mypkg").description["Depends"]).toBe("R, utils");
  });

  test("unresolved source throws", () => {
    const lockfile: RenvLockfile = {
      R: { Version: "4.3.0", Repositories: [] },
      Packages: {
        bad: {
          Package: "bad",
          Version: "1.0.0",
          Source: "",
          Hash: "x",
        },
      },
    };

    expect(() => lockfileToManifestPackages(lockfile)).toThrow(
      "unresolved source",
    );
  });

  test("unresolvable repository name throws", () => {
    const lockfile: RenvLockfile = {
      R: { Version: "4.3.0", Repositories: [] },
      Packages: {
        bad: {
          Package: "bad",
          Version: "1.0.0",
          Source: "Repository",
          Repository: "NoSuchRepo",
          Hash: "x",
        },
      },
    };

    expect(() => lockfileToManifestPackages(lockfile)).toThrow(
      "cannot be resolved to a URL",
    );
  });
});

// ---- Unit tests for helpers ----

describe("findAllRepositories", () => {
  test("includes defaults, Bioconductor, explicit repos, and RemoteRepos", () => {
    const lockfile: RenvLockfile = {
      R: {
        Version: "4.3.0",
        Repositories: [{ Name: "CRAN", URL: "https://cran.rstudio.com/" }],
      },
      Bioconductor: { Version: "3.18" },
      Packages: {
        pkg1: {
          Package: "pkg1",
          Version: "1.0",
          Source: "Repository",
          Repository: "MyRepo",
          RemoteRepos: "https://my-repo.example.com/pkgs",
        },
      },
    };

    const repos = findAllRepositories(lockfile);

    // Explicit CRAN overrides default (trailing slash trimmed)
    expect(repos.get("CRAN")).toBe("https://cran.rstudio.com");
    // RSPM default still present
    expect(repos.get("RSPM")).toBe(
      "https://packagemanager.posit.co/cran/latest",
    );
    // Bioconductor repos
    expect(repos.get("BioCsoft")).toBe(
      "https://bioconductor.org/packages/3.18/bioc",
    );
    // Discovered from RemoteRepos
    expect(repos.get("MyRepo")).toBe("https://my-repo.example.com/pkgs");
  });
});

describe("resolveRepoAndSource", () => {
  const repos = new Map([
    ["CRAN", "https://cran.rstudio.com"],
    ["BioCsoft", "https://bioconductor.org/packages/3.18/bioc"],
  ]);

  test("resolves name to URL", () => {
    const result = resolveRepoAndSource(repos, "CRAN", "Repository");
    expect(result).toEqual({
      source: "CRAN",
      repository: "https://cran.rstudio.com",
    });
  });

  test("passes through URL and finds name", () => {
    const result = resolveRepoAndSource(
      repos,
      "https://cran.rstudio.com",
      "Repository",
    );
    expect(result).toEqual({
      source: "CRAN",
      repository: "https://cran.rstudio.com",
    });
  });

  test("passes through unknown URL as both source and repository", () => {
    const result = resolveRepoAndSource(
      repos,
      "https://unknown.example.com/",
      "Repository",
    );
    expect(result).toEqual({
      source: "https://unknown.example.com",
      repository: "https://unknown.example.com",
    });
  });

  test("Bioconductor fallback when repoStr is empty", () => {
    const result = resolveRepoAndSource(repos, "", "Bioconductor");
    expect(result).toEqual({
      source: "Bioconductor",
      repository: "https://bioconductor.org/packages/3.18/bioc",
    });
  });

  test("Bioconductor source label standardized", () => {
    const result = resolveRepoAndSource(repos, "BioCsoft", "Bioconductor");
    expect(result.source).toBe("Bioconductor");
  });

  test("unknown repo name throws", () => {
    expect(() => resolveRepoAndSource(repos, "NoSuch", "Repository")).toThrow(
      "cannot be resolved to a URL",
    );
  });

  test("Bioconductor without BioCsoft repo throws", () => {
    const emptyRepos = new Map<string, string>();
    expect(() => resolveRepoAndSource(emptyRepos, "", "Bioconductor")).toThrow(
      "no Bioconductor repositories are available",
    );
  });
});
