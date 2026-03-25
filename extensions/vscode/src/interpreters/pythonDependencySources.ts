// Copyright (C) 2026 by Posit Software, PBC.

import path from "node:path";
import { parse as parseTOML } from "smol-toml";

import { readFileText } from "./fsUtils";

/**
 * Read Python dependencies from pyproject.toml's [project].dependencies.
 *
 * Optionally includes packages from [project.optional-dependencies] for the
 * specified groups.
 *
 * Returns PEP 508 dependency specifier strings (e.g. "requests>=2.20"),
 * or null if the file doesn't exist or has no [project].dependencies.
 */
export async function readPyProjectDependencies(
  projectDir: string,
  optionalGroups?: string[],
): Promise<string[] | null> {
  const content = await readFileText(path.join(projectDir, "pyproject.toml"));
  if (content === null) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseTOML(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const project = parsed.project;
  if (!project || typeof project !== "object") {
    return null;
  }

  const projectTable = project as Record<string, unknown>;
  const deps = projectTable.dependencies;
  if (!Array.isArray(deps)) {
    return null;
  }

  const result: string[] = deps.filter(
    (d): d is string => typeof d === "string",
  );

  if (optionalGroups && optionalGroups.length > 0) {
    const optDeps = projectTable["optional-dependencies"];
    if (optDeps && typeof optDeps === "object") {
      const optTable = optDeps as Record<string, unknown>;
      for (const group of optionalGroups) {
        const groupDeps = optTable[group];
        if (Array.isArray(groupDeps)) {
          for (const d of groupDeps) {
            if (typeof d === "string") {
              result.push(d);
            }
          }
        }
      }
    }
  }

  return result;
}

/** Shape of a [[package]] entry in uv.lock */
interface UvLockPackage {
  name: string;
  version?: string;
  source?: { editable?: string; registry?: string; virtual?: string };
}

/**
 * Read all pinned dependencies from a uv.lock file.
 *
 * Returns the full transitive dependency set as "name==version" strings,
 * excluding the root project (identified by an editable or virtual source).
 * Returns null if the file doesn't exist.
 */
export async function readUvLockDependencies(
  projectDir: string,
): Promise<string[] | null> {
  const content = await readFileText(path.join(projectDir, "uv.lock"));
  if (content === null) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseTOML(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const packages = parsed.package;
  if (!Array.isArray(packages)) {
    return null;
  }

  const result: string[] = [];
  for (const pkg of packages as UvLockPackage[]) {
    // Skip the root project entry
    if (pkg.source?.editable !== undefined) {
      continue;
    }
    if (pkg.source?.virtual !== undefined) {
      continue;
    }
    if (!pkg.name || !pkg.version) {
      continue;
    }
    result.push(`${pkg.name}==${pkg.version}`);
  }

  return result.length > 0 ? result : null;
}

/**
 * Try to generate Python requirements from uv.lock or pyproject.toml.
 *
 * Priority: uv.lock (pinned, full transitive set) > pyproject.toml (declared).
 * Returns the requirement lines, or null if neither source is available.
 */
export async function generateRequirements(
  projectDir: string,
  optionalGroups?: string[],
): Promise<string[] | null> {
  const fromUvLock = await readUvLockDependencies(projectDir);
  if (fromUvLock !== null) {
    return fromUvLock;
  }

  const fromPyProject = await readPyProjectDependencies(
    projectDir,
    optionalGroups,
  );
  if (fromPyProject !== null) {
    return fromPyProject;
  }

  return null;
}
