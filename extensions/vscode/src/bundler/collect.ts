// Copyright (C) 2026 by Posit Software, PBC.

import { Dirent } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import picomatch from "picomatch";

import { FileEntry } from "./types";

// Standard exclusions matching the Go bundler's walker.go.
// These are always appended after user patterns, so they take precedence.
const STANDARD_EXCLUSIONS = [
  // From rsconnect-python
  "!.Rproj.user/",
  "!.git/",
  "!.svn/",
  "!__pycache__/",
  "!packrat/",
  "!rsconnect-python/",
  "!rsconnect/",

  // From rsconnect
  "!.DS_Store",
  "!.Rhistory",
  "!.quarto/",
  "!*.Rproj",
  "!.rscignore",
  "!*_cache/",

  // Other
  "!.ipynb_checkpoints/",

  // Exclude existing manifest.json; we will create one.
  "!manifest.json",

  // renv library cannot be included
  "!renv/library",
  "!renv/sandbox",
  "!renv/staging",

  // node_modules shouldn't be deployed and can be very large
  "!node_modules/",
];

const PYTHON_BIN_PATHS = [
  "bin/python",
  "bin/python3",
  "Scripts/python.exe",
  "Scripts/python3.exe",
];

type PatternRule = {
  exclude: boolean;
  matchesPath: (relativePath: string) => boolean;
  matchesDir: boolean; // true if pattern only applies to directories
};

async function isPythonEnvironmentDir(dirPath: string): Promise<boolean> {
  for (const bin of PYTHON_BIN_PATHS) {
    try {
      await fs.access(path.join(dirPath, bin));
      return true;
    } catch {
      // not found, try next
    }
  }
  return false;
}

function isRenvLibraryDir(dirPath: string): boolean {
  const base = path.basename(dirPath);
  const parent = path.basename(path.dirname(dirPath));
  return (
    parent === "renv" &&
    (base === "library" || base === "sandbox" || base === "staging")
  );
}

// Parse a pattern string into a PatternRule.
// Returns null for blank lines and comments.
function parsePattern(patternStr: string): PatternRule | null {
  let line = patternStr.trim();

  if (line === "" || line[0] === "#") {
    return null;
  }

  let exclude = false;
  if (line[0] === "!") {
    exclude = true;
    line = line.slice(1);
  } else if (line.startsWith("\\!") || line.startsWith("\\#")) {
    line = line.slice(1);
  }

  // A trailing slash means "directories only"; strip it for matching
  let matchesDir = false;
  if (line.endsWith("/")) {
    matchesDir = true;
    line = line.slice(0, -1);
  }

  // Determine if pattern is "rooted" (should only match from the base).
  // A pattern is rooted if it contains a `/` somewhere other than the end
  // (which we already stripped). Leading `/` also roots it.
  const strippedLeadingSlash = line.startsWith("/") ? line.slice(1) : line;
  const isRooted = strippedLeadingSlash.includes("/") || line.startsWith("/");
  const glob = strippedLeadingSlash;

  const matchFn = picomatch(glob, {
    dot: true,
    // matchBase: when true, patterns without slashes match the basename
    // at any depth. When false, they match the full relative path.
    // Rooted patterns should match from the base (matchBase: false).
    // Unrooted patterns without `/` should match at any depth (matchBase: true).
    matchBase: !isRooted,
  });

  return {
    exclude,
    matchesDir,
    matchesPath: matchFn,
  };
}

function compilePatterns(userPatterns: string[]): PatternRule[] {
  // Standard exclusions MUST come after user patterns. Last match wins,
  // so this ordering guarantees standard exclusions always take precedence.
  const allPatternStrings = [...userPatterns, ...STANDARD_EXCLUSIONS];
  const rules: PatternRule[] = [];

  for (const str of allPatternStrings) {
    const rule = parsePattern(str);
    if (rule !== null) {
      rules.push(rule);
    }
  }
  return rules;
}

// Determine if a path should be included.
// For files: must have a positive (non-exclude) match.
// For directories: returns false only if explicitly excluded.
// This matches the Go walker's behavior.
function shouldInclude(
  relativePath: string,
  isDirectory: boolean,
  rules: PatternRule[],
): "include" | "exclude" | "no-match" {
  let lastMatch: "include" | "exclude" | null = null;

  for (const rule of rules) {
    // Directory-only patterns should not match files
    if (rule.matchesDir && !isDirectory) {
      continue;
    }

    if (rule.matchesPath(relativePath)) {
      lastMatch = rule.exclude ? "exclude" : "include";
    }
  }

  if (lastMatch === null) {
    return "no-match";
  }
  return lastMatch;
}

// Walk a directory, collecting files that match the patterns.
// Follows symlinks, skips Python venvs and renv library dirs.
// visitedDirs tracks resolved real paths to prevent symlink cycles.
async function walkDirectory(
  baseDir: string,
  currentDir: string,
  rules: PatternRule[],
  entries: FileEntry[],
  visitedDirs: Set<string>,
): Promise<void> {
  let dirEntries: Dirent[];
  try {
    dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (err: unknown) {
    if (isPermissionError(err)) {
      return;
    }
    throw err;
  }

  // Sort for deterministic output
  dirEntries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of dirEntries) {
    const absolutePath = path.join(currentDir, entry.name);
    const isSymlink = entry.isSymbolicLink();
    let isDir: boolean;
    let isFile: boolean;
    let symlinkSize: number | undefined;
    let symlinkMode: number | undefined;

    if (isSymlink) {
      // Follow symlink to determine if it's a file or directory
      try {
        const realPath = await fs.realpath(absolutePath);
        const stats = await fs.stat(realPath);
        isDir = stats.isDirectory();
        isFile = stats.isFile();
        symlinkSize = stats.size;
        // Mask off the file type bits, keeping only permission bits (rwxrwxrwx)
        symlinkMode = stats.mode & 0o777;
      } catch {
        // Broken symlink — skip silently (matches Go behavior)
        continue;
      }
    } else {
      isDir = entry.isDirectory();
      isFile = entry.isFile();
    }

    const relativePath = path
      .relative(baseDir, absolutePath)
      .split(path.sep)
      .join("/");

    if (isDir) {
      const match = shouldInclude(relativePath, true, rules);
      if (match === "exclude") {
        continue;
      }
      // Skip Python virtualenv directories and renv library directories
      if (
        (await isPythonEnvironmentDir(absolutePath)) ||
        isRenvLibraryDir(absolutePath)
      ) {
        continue;
      }

      // Resolve the real path to detect symlink cycles
      const realDirPath = await fs.realpath(absolutePath);
      if (visitedDirs.has(realDirPath)) {
        continue;
      }
      visitedDirs.add(realDirPath);

      entries.push({
        relativePath,
        absolutePath,
        isDirectory: true,
        size: 0,
        mode: 0o755,
      });

      await walkDirectory(baseDir, absolutePath, rules, entries, visitedDirs);
    } else if (isFile) {
      const match = shouldInclude(relativePath, false, rules);
      // Files need an explicit inclusion match
      if (match !== "include") {
        continue;
      }

      // Only stat files to get size (symlinks already have it from above)
      let size: number;
      let mode: number;
      if (symlinkSize !== undefined) {
        size = symlinkSize;
        mode = symlinkMode!;
      } else {
        try {
          const stats = await fs.stat(absolutePath);
          size = stats.size;
          // Mask off the file type bits, keeping only permission bits (rwxrwxrwx)
          mode = stats.mode & 0o777;
        } catch {
          continue;
        }
      }

      entries.push({
        relativePath,
        absolutePath,
        isDirectory: false,
        size,
        mode,
      });
    }
    // Skip non-regular, non-directory entries (sockets, etc.)
  }
}

function isPermissionError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "EACCES"
  );
}

/**
 * Collect files from a project directory, filtered by include/exclude patterns.
 *
 * Patterns follow gitignore-style conventions:
 * - `*` matches everything, `*.py` matches .py files
 * - `!pattern` excludes matching files
 * - Patterns with `/` are rooted to the base directory
 * - Patterns without `/` match at any depth
 * - Trailing `/` matches directories only
 *
 * Standard exclusions (.git, __pycache__, node_modules, etc.) are always applied.
 */
export async function collectFiles(
  projectDir: string,
  filePatterns: string[],
): Promise<FileEntry[]> {
  const patterns = filePatterns.length > 0 ? filePatterns : ["*"];
  const rules = compilePatterns(patterns);
  const entries: FileEntry[] = [];
  const visitedDirs = new Set<string>([await fs.realpath(projectDir)]);
  await walkDirectory(projectDir, projectDir, rules, entries, visitedDirs);
  return entries;
}
