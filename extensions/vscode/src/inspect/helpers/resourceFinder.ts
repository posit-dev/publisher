// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import picomatch from "picomatch";
import { logger } from "src/logging";

// Supported file extensions for resource scanning
const supportedExtensions = new Set([
  ".md",
  ".rmd",
  ".qmd",
  ".html",
  ".htm",
  ".r",
  ".css",
]);

// Extensions that trigger recursive scanning when discovered as resources
const recursiveExtensions = new Set([".html", ".htm", ".css", ".r"]);

// Markdown image: ![alt](path) with optional title
const markdownImgRe = /!\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)/g;
// Markdown link: [text](path) — filtered to .html/.htm only
const markdownLinkRe = /\[.*?\]\((.*?)(?:\s+["'].*?["'])?\)/g;
// Inline HTML img in markdown: <img src="path" ...>
const htmlImgInMarkdownRe = /<img\s+[^>]*src=["'](.*?)["'][^>]*>/g;

// HTML resource patterns
const htmlPatterns = [
  /<img\s+[^>]*src=["'](.*?)["'][^>]*>/g,
  /<link\s+[^>]*href=["'](.*?)["'][^>]*>/g,
  /<script\s+[^>]*src=["'](.*?)["'][^>]*>/g,
  /<video\s+[^>]*src=["'](.*?)["'][^>]*>/g,
  /<audio\s+[^>]*src=["'](.*?)["'][^>]*>/g,
  /<source\s+[^>]*src=["'](.*?)["'][^>]*>/g,
];

// CSS url() references
const cssUrlRe = /url\(['"]?([^'")]+)['"]?\)/g;

// R quoted strings
const doubleQuoteRe = /"([^"\n]*)"/g;
const singleQuoteRe = /'([^'\n]*)'/g;

/**
 * Discover linked resources (images, CSS, scripts, etc.) referenced from
 * content files. Scans file contents via regex and returns additional
 * paths to include in the deployment bundle.
 *
 * @param baseDir - Absolute path to the project root
 * @param files - Current file list (leading-"/" relative paths)
 * @returns Additional "/"-prefixed relative paths to append
 */
export async function findLinkedResources(
  baseDir: string,
  files: string[],
): Promise<string[]> {
  // Collect all discovered resources keyed by relative path for dedup
  const resourceMap = new Set<string>();
  const visited = new Set<string>();

  for (const file of files) {
    const absPath = path.join(baseDir, file);
    const ext = path.extname(absPath).toLowerCase();

    if (!supportedExtensions.has(ext)) {
      continue;
    }

    await discoverResources(baseDir, absPath, visited, resourceMap);
  }

  // Filter out resources already in the input files list or nested under
  // already-included directories
  const result: string[] = [];
  for (const relPath of resourceMap) {
    const prefixed = relPath.startsWith("/") ? relPath : `/${relPath}`;

    // Skip if already in input files
    if (files.includes(prefixed)) {
      continue;
    }

    // Skip if nested under an already-included directory
    const rootSegment = prefixed.split("/")[1];
    if (rootSegment && files.includes(`/${rootSegment}`)) {
      continue;
    }

    result.push(prefixed);
  }

  return result;
}

async function discoverResources(
  baseDir: string,
  absFilePath: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const ext = path.extname(absFilePath).toLowerCase();

  let content: string;
  try {
    content = await fs.readFile(absFilePath, "utf-8");
  } catch {
    logger.debug(`[resourceFinder] could not read file: ${absFilePath}`);
    return;
  }

  switch (ext) {
    case ".md":
    case ".rmd":
    case ".qmd":
      await scanMarkdown(baseDir, absFilePath, content, visited, resourceMap);
      break;
    case ".html":
    case ".htm":
      await scanHTML(baseDir, absFilePath, content, visited, resourceMap);
      break;
    case ".css":
      await scanCSS(baseDir, absFilePath, content, visited, resourceMap);
      break;
    case ".r":
      await scanR(baseDir, absFilePath, content, visited, resourceMap);
      break;
  }
}

async function scanMarkdown(
  baseDir: string,
  absFilePath: string,
  content: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const inputDir = path.dirname(absFilePath);
  const lines = content.split("\n");

  let inYAML = false;
  let yamlContent = "";
  let yamlParsed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") {
      if (!inYAML && !yamlParsed && i === 0) {
        // Opening --- must be the first line of the file
        inYAML = true;
        continue;
      } else if (inYAML) {
        inYAML = false;
        yamlParsed = true;
        await parseYAMLResourceFiles(
          yamlContent,
          baseDir,
          inputDir,
          visited,
          resourceMap,
        );
        yamlContent = "";
        continue;
      }
    }

    if (inYAML) {
      yamlContent += line + "\n";
      continue;
    }

    // Markdown image references
    const imgMatches = extractMatches(markdownImgRe, line);
    await processMatches(
      imgMatches,
      baseDir,
      inputDir,
      false,
      visited,
      resourceMap,
    );

    // Markdown links — only .html/.htm targets
    const linkMatches = extractMatches(markdownLinkRe, line);
    await processHTMLLinkMatches(
      linkMatches,
      baseDir,
      inputDir,
      visited,
      resourceMap,
    );

    // Inline HTML <img> tags
    const htmlImgMatches = extractMatches(htmlImgInMarkdownRe, line);
    await processMatches(
      htmlImgMatches,
      baseDir,
      inputDir,
      false,
      visited,
      resourceMap,
    );
  }
}

async function scanHTML(
  baseDir: string,
  absFilePath: string,
  content: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const inputDir = path.dirname(absFilePath);

  for (const pattern of htmlPatterns) {
    const matches = extractMatches(pattern, content);
    await processMatches(
      matches,
      baseDir,
      inputDir,
      false,
      visited,
      resourceMap,
    );
  }
}

async function scanCSS(
  baseDir: string,
  absFilePath: string,
  content: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const inputDir = path.dirname(absFilePath);
  const matches = extractMatches(cssUrlRe, content);
  await processMatches(matches, baseDir, inputDir, false, visited, resourceMap);
}

async function scanR(
  baseDir: string,
  absFilePath: string,
  content: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const inputDir = path.dirname(absFilePath);

  // Strip comments before extracting strings
  const strippedLines = content.split("\n").map((line) => {
    const commentIdx = line.indexOf("#");
    return commentIdx >= 0 ? line.substring(0, commentIdx) : line;
  });
  const stripped = strippedLines.join("\n");

  const doubleMatches = extractMatches(doubleQuoteRe, stripped);
  await processMatches(
    doubleMatches,
    baseDir,
    inputDir,
    false,
    visited,
    resourceMap,
  );

  const singleMatches = extractMatches(singleQuoteRe, stripped);
  await processMatches(
    singleMatches,
    baseDir,
    inputDir,
    false,
    visited,
    resourceMap,
  );
}

// ---- Match processing ----

function extractMatches(regex: RegExp, text: string): string[] {
  const results: string[] = [];
  // Reset lastIndex since we reuse global regexes
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      results.push(match[1]);
    }
  }
  return results;
}

async function processMatches(
  matches: string[],
  baseDir: string,
  inputDir: string,
  explicit: boolean,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  for (const candidate of matches) {
    if (isWebURL(candidate)) {
      continue;
    }

    await addResource(
      baseDir,
      inputDir,
      candidate,
      explicit,
      visited,
      resourceMap,
    );
  }
}

async function processHTMLLinkMatches(
  matches: string[],
  baseDir: string,
  inputDir: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  for (const candidate of matches) {
    if (isWebURL(candidate)) {
      continue;
    }
    const lower = candidate.toLowerCase();
    if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      await addResource(
        baseDir,
        inputDir,
        candidate,
        false,
        visited,
        resourceMap,
      );
    }
  }
}

// ---- Resource validation and addition ----

async function addResource(
  baseDir: string,
  inputDir: string,
  relpath: string,
  explicit: boolean,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  logger.debug(`[resourceFinder] found resource, validating: ${relpath}`);

  // Resolve absolute path: leading "/" means relative to baseDir
  let absPath: string;
  if (relpath.startsWith("/")) {
    absPath = path.join(baseDir, relpath);
  } else {
    absPath = path.resolve(inputDir, relpath);
  }

  // Check existence on disk
  let stat: { isFile(): boolean; isDirectory(): boolean };
  try {
    stat = await fs.stat(absPath);
  } catch {
    logger.debug(
      `[resourceFinder] resource does not exist on disk: ${relpath}`,
    );
    return;
  }

  // Only allow directories for explicit resource_files declarations
  if (!explicit && stat.isDirectory()) {
    return;
  }

  // Compute path relative to baseDir
  const relToBase = path.relative(baseDir, absPath).replace(/\\/g, "/");

  // Add to map if not already tracked
  if (!resourceMap.has(relToBase)) {
    logger.debug(`[resourceFinder] including resource: ${relToBase}`);
    resourceMap.add(relToBase);
  }

  // Recursively scan HTML, CSS, and R files
  const ext = path.extname(absPath).toLowerCase();
  if (recursiveExtensions.has(ext) && !visited.has(absPath)) {
    visited.add(absPath);
    await discoverResources(baseDir, absPath, visited, resourceMap);
  }
}

// ---- YAML resource_files parsing ----

async function parseYAMLResourceFiles(
  yamlContent: string,
  baseDir: string,
  inputDir: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const lines = yamlContent.split("\n");
  let inResourceFiles = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("resource_files:")) {
      logger.debug(
        "[resourceFinder] found resource_files spec in YAML front matter",
      );
      inResourceFiles = true;
      continue;
    }

    if (inResourceFiles && trimmed.startsWith("-")) {
      let itemPath = trimmed.substring(1).trim();

      // Remove quotes
      if (
        (itemPath.startsWith("'") && itemPath.endsWith("'")) ||
        (itemPath.startsWith('"') && itemPath.endsWith('"'))
      ) {
        itemPath = itemPath.substring(1, itemPath.length - 1);
      }

      if (!itemPath || isWebURL(itemPath)) {
        continue;
      }

      if (itemPath.includes("*")) {
        // Glob pattern: expand matches
        await expandGlob(itemPath, baseDir, inputDir, visited, resourceMap);
      } else {
        // Check if it's a directory
        const fullPath = path.resolve(inputDir, itemPath);
        let isDir = false;
        try {
          const stat = await fs.stat(fullPath);
          isDir = stat.isDirectory();
        } catch {
          // Not found — try as regular file
        }

        if (isDir) {
          await walkDirectory(
            fullPath,
            baseDir,
            inputDir,
            visited,
            resourceMap,
          );
        } else {
          await addResource(
            baseDir,
            inputDir,
            itemPath,
            true,
            visited,
            resourceMap,
          );
        }
      }
    } else if (inResourceFiles && !trimmed.startsWith(" ") && trimmed !== "") {
      // Left the resource_files section
      inResourceFiles = false;
    }
  }
}

// ---- Glob expansion ----

async function expandGlob(
  pattern: string,
  baseDir: string,
  inputDir: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  const isMatch = picomatch(pattern);

  // Walk inputDir to find matching files
  const entries = await walkDirectoryEntries(inputDir);
  for (const relEntry of entries) {
    if (isMatch(relEntry)) {
      await addResource(
        baseDir,
        inputDir,
        relEntry,
        true,
        visited,
        resourceMap,
      );
    }
  }
}

async function walkDirectoryEntries(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string, prefix: string): Promise<void> {
    let entries: Array<{
      name: string;
      isFile(): boolean;
      isDirectory(): boolean;
    }>;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile()) {
        results.push(relPath);
      } else if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name), relPath);
      }
    }
  }

  await walk(dir, "");
  return results;
}

async function walkDirectory(
  dirPath: string,
  baseDir: string,
  inputDir: string,
  visited: Set<string>,
  resourceMap: Set<string>,
): Promise<void> {
  let entries: Array<{
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
  }>;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile()) {
      const relToInput = path.relative(inputDir, fullPath);
      await addResource(
        baseDir,
        inputDir,
        relToInput,
        true,
        visited,
        resourceMap,
      );
    } else if (entry.isDirectory()) {
      await walkDirectory(fullPath, baseDir, inputDir, visited, resourceMap);
    }
  }
}

function isWebURL(s: string): boolean {
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("ftp://") ||
    s.startsWith("data:")
  );
}
