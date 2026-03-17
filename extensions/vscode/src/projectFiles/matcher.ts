// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import { FileMatchSource } from "../api/types/files";

export type PatternInfo = {
  source: FileMatchSource;
  pattern: string;
  exclude: boolean;
  fileName: string;
  filePath: string;
};

/**
 * Standard exclusion patterns applied to all file listings.
 * Ported from Go's internal/bundles/matcher/walker.go StandardExclusions.
 */
export const STANDARD_EXCLUSIONS: string[] = [
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
  "!packrat/",
  "!*.Rproj",
  "!.rscignore",
  // Less precise than rsconnect, which checks for a
  // matching Rmd filename in the same directory.
  "!*_cache/",

  // Other
  "!.ipynb_checkpoints/",

  // Exclude existing manifest.json; we will create one.
  "!manifest.json",

  // renv library cannot be included; Connect doesn't need it
  // and it's probably the wrong platform anyway.
  "!renv/library",
  "!renv/sandbox",
  "!renv/staging",

  // node_modules shouldn't be deployed and can be very large
  "!node_modules/",
];

type CompiledPattern = {
  source: FileMatchSource;
  pattern: string;
  exclude: boolean;
  fileName: string;
  filePath: string;
  regex: RegExp;
};

function escapeRegexCharsInPath(s: string): string {
  // eslint-disable-next-line no-useless-escape
  return s.replace(/[.\\\|+{}()<>^$\[\]?*]/g, "\\$&");
}

function escapeRegexCharsInPattern(s: string): string {
  // Escape regex-syntax characters that are NOT gitignore specials.
  // Gitignore specials: * ? [ ]  — leave those alone.
  // eslint-disable-next-line no-useless-escape
  return s.replace(/[.\\\|+{}()<>^$]/g, "\\$&");
}

function compilePattern(
  line: string,
  baseDir: string,
  filePath: string,
): CompiledPattern | null {
  let inverted = false;

  line = line.trim();
  let rawRegex = line;

  if (line === "") {
    return null;
  }
  if (line[0] === "#") {
    return null;
  }
  if (line[0] === "!") {
    inverted = true;
    rawRegex = line.substring(1);
  }
  if (line.startsWith("\\!") || line.startsWith("\\#")) {
    rawRegex = line.substring(1);
  }

  rawRegex = escapeRegexCharsInPattern(rawRegex);

  // Check if rooted: if `/` appears in beginning or middle (not just the end)
  const isRooted = rawRegex.substring(0, rawRegex.length - 1).includes("/");

  let prefix = "";
  if (rawRegex.startsWith("**/")) {
    prefix = "((.*/)|)";
    rawRegex = rawRegex.substring(3);
  }

  let suffix = "";
  if (rawRegex.endsWith("/**") || rawRegex.endsWith("/")) {
    suffix = "/.*";
    const lastSlashIndex = rawRegex.lastIndexOf("/");
    rawRegex = rawRegex.substring(0, lastSlashIndex);
  } else {
    suffix = "(/.*)?";
  }

  // Handle mid-pattern /**/
  const placeholder = "$ANY_DIR_PLACEHOLDER$";
  rawRegex = rawRegex.split("/**/").join(placeholder);

  // * matches anything except a slash
  rawRegex = rawRegex.split("*").join("([^/]*)");

  // Restore /**/ placeholder
  rawRegex = rawRegex.split(placeholder).join("/((.*/)|)");

  // ? matches any one character except /
  rawRegex = rawRegex.split("?").join("[^/]");

  // Reassemble with prefix/suffix
  rawRegex = prefix + rawRegex + suffix;

  // Convert base dir to forward slashes for matching
  const dirPath = escapeRegexCharsInPath(baseDir.split(path.sep).join("/"));

  if (isRooted) {
    // Strip leading slash from pattern to avoid double slash when joining.
    // Go's path.Join normalizes this automatically.
    const cleaned = rawRegex.startsWith("/") ? rawRegex.substring(1) : rawRegex;
    rawRegex = dirPath + "/" + cleaned;
  } else {
    rawRegex = dirPath + "((/.*/)|/)" + rawRegex;
  }

  rawRegex = "^" + rawRegex + "$";

  const regex = new RegExp(rawRegex);

  const source =
    filePath === "" ? FileMatchSource.BUILT_IN : FileMatchSource.FILE;
  const fileName = filePath === "" ? "" : path.basename(filePath);

  return {
    source,
    pattern: line,
    exclude: inverted,
    fileName,
    filePath,
    regex,
  };
}

type MatchFile = {
  filePath: string;
  patterns: CompiledPattern[];
};

function createMatchFile(
  baseDir: string,
  filePath: string,
  patternStrings: string[],
): MatchFile {
  const patterns: CompiledPattern[] = [];
  for (const s of patternStrings) {
    const compiled = compilePattern(s, baseDir, filePath);
    if (compiled !== null) {
      patterns.push(compiled);
    }
  }
  return { filePath, patterns };
}

function matchFileAgainst(
  matchFile: MatchFile,
  filePath: string,
): CompiledPattern | null {
  let match: CompiledPattern | null = null;
  for (const pattern of matchFile.patterns) {
    if (pattern.regex.test(filePath)) {
      match = pattern;
    }
  }
  return match;
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
    // Convert to forward slashes for matching
    let matchPath = filePath.split(path.sep).join("/");
    if (isDirectory) {
      matchPath += "/";
    }

    let result: CompiledPattern | null = null;
    for (const f of this.files) {
      const m = matchFileAgainst(f, matchPath);
      if (m !== null) {
        result = m;
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
