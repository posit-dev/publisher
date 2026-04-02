// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import * as yaml from "js-yaml";
import { ContentType } from "src/api/types/configurations";
import { logger } from "src/logging";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { detectMarkdownLanguagesInDirectory } from "../helpers/markdownLanguages";

interface RMarkdownMetadata {
  title?: string;
  runtime?: string;
  params?: Record<string, unknown>;
  server?: unknown; // string or { type: string }
}

// Rmd metadata is a YAML block delimited by lines containing only ---
// The .*? is non-greedy to stop at the first closing --- rather than
// matching until a possible later --- (e.g., a horizontal rule in the
// document body).
const rmdMetaRE = /^---\s*\n(.*?\n)---\s*\n/s;

const knownSiteConfigFiles = [
  "_site.yml",
  "_site.yaml",
  "_bookdown.yml",
  "_bookdown.yaml",
];

function getRmdMetadata(content: string): RMarkdownMetadata | undefined {
  const m = rmdMetaRE.exec(content);
  if (!m || !m[1]) {
    return undefined;
  }
  try {
    const metadata = yaml.load(m[1]) as RMarkdownMetadata;
    if (metadata && typeof metadata === "object") {
      return metadata;
    }
  } catch (err: unknown) {
    logger.warn(`[rmarkdown] failed to parse YAML metadata: ${err}`);
  }
  return undefined;
}

function isShinyRmd(metadata: RMarkdownMetadata | undefined): boolean {
  if (!metadata) {
    return false;
  }
  if (metadata.runtime && metadata.runtime.startsWith("shiny")) {
    return true;
  }
  if (typeof metadata.server === "string" && metadata.server === "shiny") {
    return true;
  }
  if (
    typeof metadata.server === "object" &&
    metadata.server !== null &&
    "type" in metadata.server &&
    metadata.server.type === "shiny"
  ) {
    return true;
  }
  return false;
}

export class RMarkdownDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    // When the chosen entrypoint is a site configuration yml,
    // generate a single configuration as a site project.
    if (entrypoint && knownSiteConfigFiles.includes(entrypoint.toLowerCase())) {
      logger.debug(
        `[rmarkdown] site configuration file picked as entrypoint: ${entrypoint}`,
      );
      const cfg = await this.configFromFileInspect(baseDir, entrypoint);
      if (cfg) {
        return [cfg];
      }
    }

    if (entrypoint) {
      // Optimization: skip inspection if there's a specified entrypoint
      // and it's not one of ours.
      if (path.extname(entrypoint).toLowerCase() !== ".rmd") {
        return [];
      }
    }

    const configs: PartialConfig[] = [];
    const rmdFiles = await globDir(baseDir, "*.Rmd");

    for (const rmdPath of rmdFiles) {
      const relEntrypoint = path.basename(rmdPath);
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }
      const cfg = await this.configFromFileInspect(baseDir, relEntrypoint);
      if (cfg) {
        configs.push(cfg);
      }
    }
    return configs;
  }

  private async configFromFileInspect(
    baseDir: string,
    relEntrypoint: string,
  ): Promise<PartialConfig | undefined> {
    const entrypointPath = path.join(baseDir, relEntrypoint);
    let content: string;
    try {
      content = await fs.readFile(entrypointPath, "utf-8");
    } catch (err: unknown) {
      // If the entrypoint is a site config file, we still need to proceed
      // but without file content for metadata extraction.
      logger.warn(
        `[rmarkdown] could not read entrypoint ${entrypointPath}: ${err}`,
      );
      content = "";
    }

    let metadata = getRmdMetadata(content);

    const files: string[] = [];

    // Check if this is a site project
    const siteInfo = await this.findSiteConfig(baseDir);
    if (siteInfo) {
      logger.debug(
        `[rmarkdown] found site configuration file: ${siteInfo.configFile}`,
      );
      files.push(`/${siteInfo.configFile}`);

      if (!metadata) {
        // Look for site metadata in index.Rmd or app.Rmd
        const siteMeta = await this.lookForSiteMetadata(baseDir);
        if (siteMeta) {
          logger.debug(
            `[rmarkdown] found site metadata in fallback file: ${siteMeta.indexFile}`,
          );
          metadata = siteMeta.metadata;
          content = siteMeta.indexContent;
          if (siteMeta.indexFile) {
            files.push(`/${siteMeta.indexFile}`);
          }
        }
      }
    }

    // Add the entrypoint to files
    const entrypointFile = `/${relEntrypoint}`;
    if (!files.includes(entrypointFile)) {
      files.push(entrypointFile);
    }

    const type = isShinyRmd(metadata) ? ContentType.RMD_SHINY : ContentType.RMD;

    const cfg: PartialConfig = {
      type,
      entrypoint: relEntrypoint,
      files,
    };

    if (metadata?.title) {
      cfg.title = metadata.title;
    }

    if (metadata?.params) {
      cfg.hasParameters = true;
    }

    // Detect R and Python code blocks across all .Rmd files in the directory
    const { needsR, needsPython } =
      await detectMarkdownLanguagesInDirectory(baseDir);
    if (needsR) {
      logger.info(`[rmarkdown] detected R code in ${relEntrypoint}`);
      cfg.r = {};
    }
    if (needsPython) {
      logger.info(`[rmarkdown] detected Python code in ${relEntrypoint}`);
      cfg.python = {};
    }

    return cfg;
  }

  private async findSiteConfig(
    baseDir: string,
  ): Promise<{ configFile: string } | undefined> {
    for (const configFile of knownSiteConfigFiles) {
      const configPath = path.join(baseDir, configFile);
      try {
        await fs.access(configPath);
        return { configFile };
      } catch {
        continue;
      }
    }
    return undefined;
  }

  private async lookForSiteMetadata(baseDir: string): Promise<
    | {
        metadata: RMarkdownMetadata;
        indexFile: string;
        indexContent: string;
      }
    | undefined
  > {
    const possibleIndexFiles = ["index.Rmd", "index.rmd", "app.Rmd", "app.rmd"];
    for (const file of possibleIndexFiles) {
      const filePath = path.join(baseDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const metadata = getRmdMetadata(content);
        if (metadata) {
          return { metadata, indexFile: file, indexContent: content };
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }
}
