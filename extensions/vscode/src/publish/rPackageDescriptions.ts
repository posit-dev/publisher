// Copyright (C) 2026 by Posit Software, PBC.

import type { ManifestPackage } from "../bundler/types";

// ---- renv.lock types (PascalCase, matching the JSON keys in renv.lock) ----

export type RenvLockfile = {
  R: {
    Version: string;
    Repositories: Array<{ Name: string; URL: string }>;
  };
  Bioconductor?: {
    Version: string;
  };
  Packages: Record<string, RenvPackage>;
};

export type RenvPackage = {
  Package: string;
  Version: string;
  Source: string;
  Repository?: string;
  Requirements?: string[];
  Depends?: string[];
  Hash?: string;

  // Remote metadata (git-hosted packages)
  RemoteType?: string;
  RemotePkgRef?: string;
  RemoteRef?: string;
  RemoteRepos?: string;
  RemoteReposName?: string;
  RemotePkgPlatform?: string;
  RemoteSha?: string;
  RemoteHost?: string;
  RemoteRepo?: string;
  RemoteUsername?: string;
  RemoteSubdir?: string;
  RemoteUrl?: string;

  // Additional DESCRIPTION fields that may appear in renv.lock
  Title?: string;
  "Authors@R"?: string;
  Description?: string;
  License?: string;
  Maintainer?: string;
  VignetteBuilder?: string;
  RoxygenNote?: string;
  Encoding?: string;
  NeedsCompilation?: string;
  Author?: string;
  SystemRequirements?: string;
  URL?: string;
  BugReports?: string;
  Imports?: string[];
  Suggests?: string[];
  LinkingTo?: string[];
  "Config/testthat/edition"?: string;
  "Config/Needs/website"?: string;
};

// ---- Conversion logic ----

/**
 * Convert a parsed renv.lock into the manifest `packages` map.
 *
 * This is a pure data transformation — no I/O, no R subprocess.
 * It extracts package metadata directly from the lockfile,
 * without requiring packages to be installed locally.
 */
export function lockfileToManifestPackages(
  lockfile: RenvLockfile,
): Record<string, ManifestPackage> {
  const repoNameToURL = findAllRepositories(lockfile);
  const result: Record<string, ManifestPackage> = {};

  for (const [pkgName, pkg] of Object.entries(lockfile.Packages)) {
    const { source, repository } = resolvePackageSource(pkg, repoNameToURL);

    if (!source) {
      throw new Error(
        `Package ${pkgName} has an unresolved source; cannot generate manifest entry`,
      );
    }
    if (!repository) {
      throw new Error(
        `Package ${pkgName} has an unresolved repository; cannot generate manifest entry`,
      );
    }

    const fallbackTitle = `${source} R package`;
    const description = buildDescription(pkg, repository, {
      Package: pkgName,
      Version: pkg.Version,
      Type: "Package",
      Title: pkg.Title || fallbackTitle,
    });

    result[pkgName] = { Source: source, Repository: repository, description };
  }

  return result;
}

// ---- Source/repository resolution ----

/**
 * Resolve a single package's Source and Repository URL.
 *
 * renv packages fall into three categories:
 * 1. Git-hosted (GitHub/GitLab/Bitbucket) — URL constructed from remote type + ref
 * 2. Repository-based (CRAN, RSPM, Bioconductor, custom) — looked up in repo map
 * 3. Bioconductor without explicit Repository field — falls back to BioCsoft
 */
function resolvePackageSource(
  pkg: RenvPackage,
  repoNameToURL: Map<string, string>,
): { source: string; repository: string } {
  // Prefer RemoteRepos over Repository when present (more specific)
  const repoIdentifier = pkg.RemoteRepos || pkg.Repository || "";
  const pkgRef = remotePkgRefOrDerived(pkg);

  if (!repoIdentifier && pkg.RemoteType) {
    // Case 1: Git-hosted package with no standard repository
    return {
      source: pkg.RemoteType,
      repository: remoteRepoURL(pkg.RemoteType, pkgRef) || pkg.RemoteUrl || "",
    };
  }

  if (repoIdentifier || pkg.Source === "Bioconductor") {
    // Case 2 & 3: Repository-based or Bioconductor
    return resolveRepoAndSource(repoNameToURL, repoIdentifier, pkg.Source);
  }

  // No resolution possible — return raw values (validation happens in caller)
  return { source: pkg.Source, repository: pkg.Repository ?? "" };
}

/**
 * Build a comprehensive repository name→URL map from all sources in the lockfile.
 *
 * Priority (later entries override earlier):
 * 1. Hardcoded defaults (CRAN, RSPM)
 * 2. Bioconductor repos derived from lockfile version
 * 3. Explicit R.Repositories entries
 * 4. Repos discovered from package RemoteRepos fields
 */
export function findAllRepositories(
  lockfile: RenvLockfile,
): Map<string, string> {
  const repos = new Map<string, string>([
    ["CRAN", "https://cloud.r-project.org"],
    ["RSPM", "https://packagemanager.posit.co/cran/latest"],
  ]);

  const biocVersion = lockfile.Bioconductor?.Version;
  if (biocVersion) {
    const base = `https://bioconductor.org/packages/${biocVersion}`;
    repos.set("BioCsoft", `${base}/bioc`);
    repos.set("BioCann", `${base}/data/annotation`);
    repos.set("BioCexp", `${base}/data/experiment`);
    repos.set("BioCworkflows", `${base}/workflows`);
    repos.set("BioCbooks", `${base}/books`);
  }

  for (const r of lockfile.R.Repositories) {
    repos.set(r.Name, r.URL.replace(/\/+$/, ""));
  }

  // Discover repos from package RemoteRepos fields (only when it's a URL)
  for (const pkg of Object.values(lockfile.Packages)) {
    if (pkg.RemoteRepos && pkg.Repository && isURL(pkg.RemoteRepos)) {
      repos.set(pkg.Repository, pkg.RemoteRepos.replace(/\/+$/, ""));
    }
  }

  return repos;
}

/**
 * Normalize a repository reference to { source, repository }.
 *
 * `repoStr` may be a repository name ("CRAN") or a URL.
 * `src` is the lockfile's Source field (e.g. "Repository", "Bioconductor").
 *
 * Also standardizes the Bioconductor source label: any package from a
 * Bioconductor repo gets Source="Bioconductor" regardless of the repo name.
 */
export function resolveRepoAndSource(
  repoNameToURL: Map<string, string>,
  repoStr: string,
  src: string,
): { source: string; repository: string } {
  let repoURL: string;
  let repoName: string;

  if (isURL(repoStr)) {
    repoURL = repoStr.replace(/\/+$/, "");
    // Reverse-lookup the name for this URL
    repoName = repoURL;
    for (const [name, url] of repoNameToURL) {
      if (url === repoURL) {
        repoName = name;
        break;
      }
    }
  } else if (repoStr) {
    const url = repoNameToURL.get(repoStr);
    if (url === undefined) {
      throw new Error(`repository ${repoStr} cannot be resolved to a URL`);
    }
    repoURL = url;
    repoName = repoStr;
  } else if (src === "Bioconductor") {
    const biocURL = repoNameToURL.get("BioCsoft");
    if (biocURL === undefined) {
      throw new Error(
        "Bioconductor package source specified but no Bioconductor repositories are available",
      );
    }
    repoURL = biocURL;
    repoName = "BioCsoft";
  } else {
    throw new Error(`repository ${repoStr} could not be resolved to a URL`);
  }

  // Standardize Bioconductor source label
  const isBioc =
    src === "Bioconductor" ||
    repoName.startsWith("BioC") ||
    repoURL.toLowerCase().includes("bioconductor.org/packages/");
  const source = isBioc ? "Bioconductor" : repoName;

  return { source, repository: repoURL };
}

// ---- Description record construction ----

/**
 * Build the full DESCRIPTION record for a manifest package entry.
 *
 * Starts from `initial` (Package, Version, Type, Title) and adds all
 * available metadata from the lockfile. Uses "first write wins" semantics:
 * a field is only set if it hasn't been set already.
 */
function buildDescription(
  pkg: RenvPackage,
  resolvedRepo: string,
  initial: Record<string, string>,
): Record<string, string> {
  const desc = { ...initial };

  // Core metadata
  setIf(desc, "Hash", pkg.Hash);
  setIf(desc, "Authors@R", pkg["Authors@R"]);
  setIf(desc, "Description", pkg.Description);
  setIf(desc, "License", pkg.License);
  setIf(desc, "Maintainer", pkg.Maintainer);
  setIf(desc, "VignetteBuilder", pkg.VignetteBuilder);
  setIf(desc, "RoxygenNote", pkg.RoxygenNote);
  setIf(desc, "Encoding", pkg.Encoding);
  setIf(desc, "NeedsCompilation", pkg.NeedsCompilation);
  setIf(desc, "Author", pkg.Author);
  setIf(desc, "SystemRequirements", pkg.SystemRequirements);

  // Remote metadata
  setIf(desc, "RemoteType", pkg.RemoteType);
  setIf(desc, "RemoteRef", pkg.RemoteRef);
  setIf(desc, "RemoteRepos", pkg.RemoteRepos);
  setIf(desc, "RemoteReposName", pkg.RemoteReposName);
  setIf(desc, "RemotePkgPlatform", pkg.RemotePkgPlatform);
  setIf(desc, "RemoteSha", pkg.RemoteSha);
  setIf(desc, "RemoteHost", pkg.RemoteHost);
  setIf(desc, "RemoteRepo", pkg.RemoteRepo);
  setIf(desc, "RemoteUsername", pkg.RemoteUsername);
  setIf(desc, "RemoteSubdir", pkg.RemoteSubdir);
  setIf(desc, "GithubSubdir", pkg.RemoteSubdir);
  setIf(desc, "RemoteUrl", pkg.RemoteUrl);

  // RemotePkgRef: use explicit value, or derive from RemoteUsername/RemoteRepo
  const pkgRef = remotePkgRefOrDerived(pkg);
  if (pkgRef) {
    desc["RemotePkgRef"] = pkgRef;
  }

  // GitHub packages get synthesized URL/BugReports when RemotePkgRef is explicit
  if (pkg.RemoteType === "github" && pkg.RemotePkgRef) {
    setIf(desc, "URL", `https://github.com/${pkg.RemotePkgRef}`);
    setIf(desc, "BugReports", `https://github.com/${pkg.RemotePkgRef}/issues`);
  }
  setIf(desc, "URL", pkg.URL);
  setIf(desc, "BugReports", pkg.BugReports);
  setIf(desc, "Repository", resolvedRepo);

  // Config fields
  setIf(desc, "Config/testthat/edition", pkg["Config/testthat/edition"]);
  setIf(desc, "Config/Needs/website", pkg["Config/Needs/website"]);

  // Array fields as comma-separated strings (DESCRIPTION format)
  setIf(desc, "Imports", joinList(pkg.Imports));
  setIf(desc, "Suggests", joinList(pkg.Suggests));
  setIf(desc, "LinkingTo", joinList(pkg.LinkingTo));

  // Depends: prefer explicit Depends, fall back to Requirements
  if (pkg.Depends?.length) {
    setIf(desc, "Depends", joinList(pkg.Depends));
  } else if (pkg.Requirements?.length) {
    setIf(desc, "Depends", joinList(pkg.Requirements));
  }

  return desc;
}

// ---- Small helpers ----

function isURL(s: string): boolean {
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("ftp://")
  );
}

/** Return `RemotePkgRef`, or synthesize it from `RemoteUsername/RemoteRepo`. */
function remotePkgRefOrDerived(pkg: RenvPackage): string {
  return (
    pkg.RemotePkgRef ||
    (pkg.RemoteUsername && pkg.RemoteRepo
      ? `${pkg.RemoteUsername}/${pkg.RemoteRepo}`
      : "")
  );
}

/** Build a repository URL for known git hosting providers. */
function remoteRepoURL(remoteType: string, pkgRef: string): string {
  if (!pkgRef) return "";
  switch (remoteType) {
    case "github":
      return `https://github.com/${pkgRef}`;
    case "gitlab":
      return `https://gitlab.com/${pkgRef}`;
    case "bitbucket":
      return `https://bitbucket.org/${pkgRef}`;
    default:
      return "";
  }
}

/** Set `desc[key] = value` only if value is non-empty AND key is not already set. */
function setIf(
  desc: Record<string, string>,
  key: string,
  value: string | undefined,
): void {
  if (value && !desc[key]) {
    desc[key] = value;
  }
}

function joinList(arr: string[] | undefined): string | undefined {
  return arr?.length ? arr.join(", ") : undefined;
}
