// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import picomatch from "picomatch";
import { FileMatchSource } from "../api/types/files";

// Re-export STANDARD_EXCLUSIONS from the bundler so existing imports don't break
export { STANDARD_EXCLUSIONS } from "../bundler";

export type PatternInfo = {
  source: FileMatchSource;
  pattern: string;
  exclude: boolean;
  fileName: string;
  filePath: string;
};

type CompiledPattern = {
  source: FileMatchSource;
  pattern: string;
  exclude: boolean;
  fileName: string;
  filePath: string;
  matches: (relativePath: string, isDirectory: boolean) => boolean;
};

type MatchFile = {
  baseDir: string;
  filePath: string;
  patterns: CompiledPattern[];
};

function parsePattern(
  line: string,
  source: FileMatchSource,
  fileName: string,
  filePath: string,
): CompiledPattern | null {
  const originalLine = line.trim();
  let pat = originalLine;

  if (pat === "" || pat[0] === "#") {
    return null;
  }

  let exclude = false;
  if (pat[0] === "!") {
    exclude = true;
    pat = pat.slice(1);
  } else if (pat.startsWith("\\!") || pat.startsWith("\\#")) {
    pat = pat.slice(1);
  }

  // A trailing slash means "directories only"; strip it for matching
  let matchesDir = false;
  if (pat.endsWith("/")) {
    matchesDir = true;
    pat = pat.slice(0, -1);
  }

  // Determine if pattern is "rooted" (should only match from the base).
  // A pattern is rooted if it contains a `/` somewhere other than the end
  // (which we already stripped). Leading `/` also roots it.
  const strippedLeadingSlash = pat.startsWith("/") ? pat.slice(1) : pat;
  const isRooted = strippedLeadingSlash.includes("/") || pat.startsWith("/");
  const glob = strippedLeadingSlash;

  const matchFn = picomatch(glob, {
    dot: true,
    // matchBase: when true, patterns without slashes match the basename
    // at any depth. When false, they match the full relative path.
    // Rooted patterns should match from the base (matchBase: false).
    // Unrooted patterns without `/` should match at any depth (matchBase: true).
    matchBase: !isRooted,
  });

  // Combined matcher that handles both direct and content matching.
  // A pattern like "dir/" matches the directory itself AND everything inside it.
  // A pattern like "app.py" matches the file AND (if it were a dir) its contents.
  const matches = (relativePath: string, isDirectory: boolean): boolean => {
    // Direct match: the path itself matches the pattern
    if (matchFn(relativePath)) {
      // If pattern had trailing slash, only match directories
      return matchesDir ? isDirectory : true;
    }

    // Content match: check if any parent directory matches the pattern,
    // meaning this path is inside a matching directory
    const parts = relativePath.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (matchFn(parts.slice(0, i).join("/"))) {
        return true;
      }
    }

    return false;
  };

  return {
    source,
    pattern: originalLine,
    exclude,
    fileName,
    filePath,
    matches,
  };
}

function createMatchFile(
  baseDir: string,
  filePath: string,
  patternStrings: string[],
): MatchFile {
  const source =
    filePath === "" ? FileMatchSource.BUILT_IN : FileMatchSource.FILE;
  const fileName = filePath === "" ? "" : path.basename(filePath);

  const patterns: CompiledPattern[] = [];
  for (const s of patternStrings) {
    const compiled = parsePattern(s, source, fileName, filePath);
    if (compiled !== null) {
      patterns.push(compiled);
    }
  }
  return { baseDir, filePath, patterns };
}

export class MatchList {
  private files: MatchFile[];

  constructor(baseDir: string, builtinPatterns: string[]) {
    this.files = [createMatchFile(baseDir, "", builtinPatterns)];
  }

  addFromFile(baseDir: string, filePath: string, patterns: string[]): void {
    const newFile = createMatchFile(baseDir, filePath, patterns);
    // Insert before the last element (builtins stay last)
    this.files.splice(this.files.length - 1, 0, newFile);
  }

  match(filePath: string, isDirectory: boolean): PatternInfo | null {
    let result: CompiledPattern | null = null;

    for (const f of this.files) {
      // Convert absolute path to relative, using forward slashes
      const rel = path.relative(f.baseDir, filePath).split(path.sep).join("/");
      if (rel === "" || rel.startsWith("..")) {
        continue;
      }

      for (const pattern of f.patterns) {
        if (pattern.matches(rel, isDirectory)) {
          result = pattern;
        }
      }
    }

    if (result === null) {
      return null;
    }

    return {
      source: result.source,
      pattern: result.pattern,
      exclude: result.exclude,
      fileName: result.fileName,
      filePath: result.filePath,
    };
  }
}
