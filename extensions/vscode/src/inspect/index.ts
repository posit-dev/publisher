// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs/promises";
import * as path from "path";
import {
  ConfigurationDetails,
  ConfigurationInspectionResult,
  ContentType,
} from "src/api/types/configurations";
import { logger } from "src/logging";
import { ProductType } from "src/api/types/contentRecords";
import { runDetectors } from "./detectorRunner";
import { normalizeConfig, NormalizedConfig } from "./normalize";
import { sortConfigs } from "./sorting";
import { InspectOptions, PartialConfig } from "./types";

const CONFIG_SCHEMA_URL =
  "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json";

// Convert a raw PartialConfig alternative into a ConfigurationDetails.
// Matches Go behavior: alternatives get $schema and validate from config.New(),
// plus the fields set by the detector (type, title, source, entrypoint, files).
// They are NOT normalized (no comments, no interpreter detection, no productType).
function alternativeToDetails(alt: PartialConfig): ConfigurationDetails {
  return {
    $schema: CONFIG_SCHEMA_URL,
    type: alt.type,
    entrypoint: alt.entrypoint,
    title: alt.title,
    source: alt.source,
    files: alt.files,
    validate: true,
    productType: "" as ProductType,
  };
}

function toConfigurationDetails(
  normalized: NormalizedConfig,
): ConfigurationDetails {
  return {
    $schema: CONFIG_SCHEMA_URL,
    type: normalized.type,
    entrypoint: normalized.entrypoint,
    entrypointObjectRef: normalized.entrypointObjectRef,
    title: normalized.title,
    source: normalized.source,
    hasParameters: normalized.hasParameters,
    files: normalized.files,
    python: normalized.python,
    r: normalized.r,
    quarto: normalized.quarto,
    comments: normalized.comments,
    validate: true,
    productType: ProductType.CONNECT,
    alternatives: normalized.alternatives?.map(alternativeToDetails),
  };
}

/**
 * Inspect a project directory to detect content types and return configuration suggestions.
 * This is the TypeScript replacement for the Go POST /inspect endpoint.
 */
export function inspectProject(
  options: InspectOptions,
): Promise<ConfigurationInspectionResult[]> {
  const { projectDir, pythonPath, rPath, entrypoint, recursive } = options;
  const mode = recursive ? "recursive" : "single";
  logger.info(`[inspect] starting inspection of ${projectDir} (mode=${mode})`);

  if (recursive) {
    return inspectRecursive(projectDir, pythonPath, rPath, entrypoint);
  }

  return inspectSingleDir(projectDir, pythonPath, rPath, entrypoint);
}

async function inspectSingleDir(
  projectDir: string,
  pythonPath?: string,
  rPath?: string,
  entrypoint?: string,
): Promise<ConfigurationInspectionResult[]> {
  const configs = await runDetectors(projectDir, entrypoint);

  const results: ConfigurationInspectionResult[] = [];
  for (const cfg of configs) {
    const normalized = await normalizeConfig(
      cfg,
      projectDir,
      pythonPath,
      rPath,
      entrypoint,
    );
    results.push({
      configuration: toConfigurationDetails(normalized),
      projectDir: ".",
    });
  }
  logger.info(
    `[inspect] inspection complete, found ${results.length} configuration(s)`,
  );
  return results;
}

async function inspectRecursive(
  projectDir: string,
  pythonPath?: string,
  rPath?: string,
  entrypoint?: string,
): Promise<ConfigurationInspectionResult[]> {
  const allResults: ConfigurationInspectionResult[] = [];
  const allPartials: PartialConfig[] = [];

  await walkDirectory(projectDir, projectDir, async (dir, relDir) => {
    const configs = await runDetectors(dir, entrypoint);

    for (const cfg of configs) {
      if (cfg.type === ContentType.UNKNOWN) {
        continue;
      }
      const normalized = await normalizeConfig(
        cfg,
        dir,
        pythonPath,
        rPath,
        entrypoint,
      );
      allResults.push({
        configuration: toConfigurationDetails(normalized),
        projectDir: relDir,
      });
      allPartials.push(cfg);
    }
  });

  // Sort all results using the same logic
  if (allPartials.length > 0) {
    const sortedPartials = sortConfigs(allPartials, path.basename(projectDir));
    // Reorder results to match sorted partials
    const sortedResults: ConfigurationInspectionResult[] = [];
    for (const partial of sortedPartials) {
      const idx = allPartials.indexOf(partial);
      if (idx !== -1 && allResults[idx]) {
        sortedResults.push(allResults[idx]);
      }
    }
    logger.info(
      `[inspect] recursive inspection complete, found ${sortedResults.length} configuration(s)`,
    );
    return sortedResults;
  }
  logger.info(
    `[inspect] recursive inspection complete, found ${allResults.length} configuration(s)`,
  );
  return allResults;
}

// Directories to skip during recursive inspection, matching Go's behavior.
const SKIP_DIRS = new Set([
  ".posit",
  ".git",
  ".svn",
  "node_modules",
  "__pycache__",
  ".venv",
  "env",
  "venv",
  ".Rproj.user",
  "renv",
  "packrat",
  ".quarto",
  ".ipynb_checkpoints",
  "rsconnect",
  "rsconnect-python",
]);

async function walkDirectory(
  baseDir: string,
  currentDir: string,
  callback: (dir: string, relDir: string) => Promise<void>,
): Promise<void> {
  const relDir = path.relative(baseDir, currentDir) || ".";

  await callback(currentDir, relDir);

  let entries: string[];
  try {
    entries = await fs.readdir(currentDir);
  } catch {
    return;
  }

  for (const entry of entries.sort()) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const fullPath = path.join(currentDir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await walkDirectory(baseDir, fullPath, callback);
      }
    } catch {
      // Entry may have been deleted
    }
  }
}
