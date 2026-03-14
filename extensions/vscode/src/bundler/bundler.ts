// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as path from "path";

import { BundleOptions, BundleResult } from "./types";
import { collectFiles } from "./collect";
import { createArchive } from "./archive";

/**
 * Create a deployment bundle (tar.gz) from a project directory.
 *
 * Takes a project path, a pre-built manifest (with metadata, python/R config,
 * packages, etc. already populated), and optional file patterns.
 *
 * Returns the tar.gz buffer and the manifest updated with the `files` section.
 *
 * If `projectPath` points to a file instead of a directory, the containing
 * directory is used as the base and the file is force-included in the bundle
 * even if patterns would otherwise exclude it.
 */
export function createBundle(options: BundleOptions): Promise<BundleResult> {
  const { projectPath, manifest, filePatterns } = options;
  const patterns = filePatterns ?? [];

  const stats = fs.statSync(projectPath);
  let baseDir: string;
  let entrypointFile: string | undefined;

  if (stats.isDirectory()) {
    baseDir = projectPath;
  } else {
    baseDir = path.dirname(projectPath);
    entrypointFile = path.basename(projectPath);
  }

  const files = collectFiles(baseDir, patterns);

  // If deploying a single file, ensure it's included even if patterns excluded it
  if (entrypointFile) {
    const entrypointRelPath = entrypointFile;
    const alreadyIncluded = files.some(
      (f) => f.relativePath === entrypointRelPath,
    );
    if (!alreadyIncluded) {
      const entrypointAbsPath = path.join(baseDir, entrypointFile);
      const entrypointStats = fs.statSync(entrypointAbsPath);
      files.push({
        relativePath: entrypointRelPath,
        absolutePath: entrypointAbsPath,
        isDirectory: false,
        size: entrypointStats.size,
      });
    }
  }

  return createArchive(files, manifest);
}
