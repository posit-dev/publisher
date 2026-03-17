// Copyright (C) 2026 by Posit Software, PBC.

import * as nodeFs from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import {
  ContentRecordFile,
  ContentRecordFileType,
  FileMatch,
  FileMatchSource,
} from "../api/types/files";
import { MatchList, PatternInfo } from "./matcher";

const PYTHON_BIN_PATHS = [
  path.join("bin", "python"),
  path.join("bin", "python3"),
  path.join("Scripts", "python.exe"),
  path.join("Scripts", "python3.exe"),
];

async function isPythonEnvironmentDir(dirPath: string): Promise<boolean> {
  for (const binary of PYTHON_BIN_PATHS) {
    try {
      await fs.access(path.join(dirPath, binary));
      return true;
    } catch {
      // not found, continue
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

function patternInfoToFileMatch(info: PatternInfo): FileMatch {
  return {
    source: info.source,
    pattern: info.pattern,
    exclude: info.exclude,
    fileName: info.fileName,
    filePath: info.filePath,
  };
}

interface StatLike {
  size: number;
  mtime: Date;
  isDirectory: () => boolean;
  isFile: () => boolean;
}

function createFileNodeFromStats(
  rootDir: string,
  absPath: string,
  stats: StatLike,
  reason: FileMatch | null,
): ContentRecordFile {
  const rel = path.relative(rootDir, absPath);
  const relForwardSlash = rel === "" ? "." : rel.split(path.sep).join("/");

  return {
    id: relForwardSlash,
    fileType: stats.isDirectory()
      ? ContentRecordFileType.DIRECTORY
      : ContentRecordFileType.REGULAR,
    base: path.basename(absPath) || ".",
    reason,
    files: [],
    isDir: stats.isDirectory(),
    isFile: stats.isFile(),
    modifiedDatetime: stats.mtime.toISOString(),
    rel: rel || ".",
    relDir: rel === "" ? "." : path.dirname(rel) || ".",
    size: stats.size,
    fileCount: 0,
    abs: absPath,
    allIncluded: false,
    allExcluded: false,
  };
}

function insertIntoTree(
  root: ContentRecordFile,
  rootDir: string,
  absPath: string,
  stats: StatLike,
  reason: FileMatch | null,
): ContentRecordFile {
  const rel = path.relative(rootDir, absPath);
  const parts = rel.split(path.sep);

  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const partPath = path.join(rootDir, ...parts.slice(0, i + 1));
    let child = current.files.find((f) => f.abs === partPath);
    if (!child) {
      child = createFileNodeFromStats(rootDir, partPath, stats, reason);
      current.files.push(child);
    }
    current = child;
  }

  const existing = current.files.find((f) => f.abs === absPath);
  if (existing) {
    return existing;
  }

  const node = createFileNodeFromStats(rootDir, absPath, stats, reason);
  current.files.push(node);
  return node;
}

function calculateDirectorySizes(node: ContentRecordFile): void {
  if (!node.isDir) {
    node.fileCount = 1;
    return;
  }

  let totalSize = 0;
  let totalFileCount = 0;

  for (const child of node.files) {
    if (child.isDir) {
      calculateDirectorySizes(child);
    } else {
      child.fileCount = 1;
    }
    totalSize += child.size;
    totalFileCount += child.fileCount;
  }

  node.size = totalSize;
  node.fileCount = totalFileCount;
}

function calculateInclusions(node: ContentRecordFile): void {
  if (!node.isDir) {
    const included = node.reason !== null && !node.reason.exclude;
    node.allIncluded = included;
    node.allExcluded = !included;
    return;
  }

  let allIncluded = true;
  let allExcluded = true;

  for (const child of node.files) {
    calculateInclusions(child);
    allIncluded = allIncluded && child.allIncluded;
    allExcluded = allExcluded && child.allExcluded;
  }

  node.allIncluded = allIncluded;
  node.allExcluded = allExcluded;
}

async function walkDirectory(
  rootDir: string,
  currentDir: string,
  matchList: MatchList,
  root: ContentRecordFile,
  visitedRealPaths: Set<string>,
): Promise<void> {
  let entries: nodeFs.Dirent[];
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (err: unknown) {
    if (isErrnoException(err) && err.code === "EACCES") {
      if (currentDir !== rootDir) {
        const stats = await safeStat(currentDir);
        if (stats) {
          const permReason: FileMatch = {
            source: FileMatchSource.PERMISSIONS_ERROR,
            pattern: "",
            exclude: true,
            fileName: "",
            filePath: "",
          };
          insertIntoTree(root, rootDir, currentDir, stats, permReason);
        }
      }
      return;
    }
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    let stats: nodeFs.Stats;
    const isSymlink = entry.isSymbolicLink();
    let resolvedPath = entryPath;

    try {
      if (isSymlink) {
        resolvedPath = await fs.realpath(entryPath);
        stats = await fs.stat(resolvedPath);
      } else {
        stats = await fs.stat(entryPath);
      }
    } catch {
      continue;
    }

    // Circular symlink protection
    if (isSymlink && stats.isDirectory()) {
      if (visitedRealPaths.has(resolvedPath)) {
        continue;
      }
      visitedRealPaths.add(resolvedPath);
    }

    // Skip unsupported file types (sockets, pipes, etc.)
    if (!stats.isFile() && !stats.isDirectory()) {
      continue;
    }

    const isDir = stats.isDirectory();
    const matchResult = matchList.match(entryPath, isDir);
    const reason = matchResult ? patternInfoToFileMatch(matchResult) : null;

    if (isDir) {
      if (
        (await isPythonEnvironmentDir(entryPath)) ||
        isRenvLibraryDir(entryPath)
      ) {
        continue;
      }

      let canRead = true;
      try {
        await fs.readdir(entryPath);
      } catch (err: unknown) {
        if (isErrnoException(err) && err.code === "EACCES") {
          canRead = false;
          const permReason: FileMatch = {
            source: FileMatchSource.PERMISSIONS_ERROR,
            pattern: "",
            exclude: true,
            fileName: "",
            filePath: "",
          };
          insertIntoTree(root, rootDir, entryPath, stats, permReason);
        }
      }

      if (canRead) {
        insertIntoTree(root, rootDir, entryPath, stats, reason);
        await walkDirectory(
          rootDir,
          entryPath,
          matchList,
          root,
          visitedRealPaths,
        );
      }
    } else {
      insertIntoTree(root, rootDir, entryPath, stats, reason);
    }
  }
}

async function safeStat(filePath: string): Promise<nodeFs.Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

export async function buildFileTree(
  baseDir: string,
  matchList: MatchList,
): Promise<ContentRecordFile> {
  const stats: nodeFs.Stats = await fs.stat(baseDir);
  const matchResult = matchList.match(baseDir, true);
  const reason = matchResult ? patternInfoToFileMatch(matchResult) : null;

  const root = createFileNodeFromStats(baseDir, baseDir, stats, reason);

  const visitedRealPaths = new Set<string>();
  const realBase = await fs.realpath(baseDir);
  visitedRealPaths.add(realBase);

  await walkDirectory(baseDir, baseDir, matchList, root, visitedRealPaths);

  calculateInclusions(root);
  calculateDirectorySizes(root);

  return root;
}
