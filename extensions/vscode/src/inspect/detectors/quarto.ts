// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { ContentType } from "src/api/types/configurations";
import { logger } from "src/logging";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { detectMarkdownLanguagesInContent } from "../helpers/markdownLanguages";
import { findLinkedResources } from "../helpers/resourceFinder";
import { QuartoInspectOutput } from "./quartoInspectOutput";

const execFileAsync = promisify(execFile);

const specialYmlFiles = [
  "_quarto.yml",
  "_quarto.yaml",
  "_metadata.yml",
  "_metadata.yaml",
  "_brand.yml",
  "_brand.yaml",
];

// Fallback version used when `quarto inspect` is unavailable (e.g. quarto not
// installed). Matches the latest stable release at the time this detector was
// written. The exact value is non-critical — Connect uses it only as a hint.
const defaultQuartoVersion = "1.7.34";

const quartoSuffixes = [".qmd", ".Rmd", ".ipynb", ".R", ".py", ".jl"];
const quartoSuffixesLower = quartoSuffixes.map((s) => s.toLowerCase());

function isQuartoShiny(metadata: {
  runtime?: string;
  server?: unknown;
}): boolean {
  if (metadata.runtime === "shiny" || metadata.server === "shiny") {
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

function isQuartoYaml(entrypointBase: string): boolean {
  return ["_quarto.yml", "_quarto.yaml"].includes(entrypointBase);
}

function isExpectedInspectFailure(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if (obj.code === "ENOENT") {
      return true;
    }
    if (typeof obj.stderr === "string") {
      return obj.stderr.includes("is not a valid Quarto input document");
    }
  }
  return false;
}

export class QuartoDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    // The `quarto inspect` CLI does not accept _quarto.yml as a direct target.
    // Instead, pass the project directory which inspects the full project.
    if (entrypoint && isQuartoYaml(path.basename(entrypoint))) {
      const cfg = await this.configFromInspect(baseDir, baseDir);
      if (cfg) {
        // Override entrypoint to the directory dot (will be resolved later)
        cfg.entrypoint = ".";
        return [cfg];
      }
    }

    if (entrypoint) {
      const ext = path.extname(entrypoint).toLowerCase();
      if (!quartoSuffixesLower.includes(ext)) {
        return [];
      }
    }

    const configs: PartialConfig[] = [];
    const entrypointPaths = await this.findEntrypoints(baseDir);

    for (const epPath of entrypointPaths) {
      const relEntrypoint = path.basename(epPath);
      if (entrypoint && relEntrypoint !== entrypoint) {
        continue;
      }
      const cfg = await this.configFromInspect(baseDir, epPath);
      if (cfg) {
        configs.push(cfg);
      }
    }
    return configs;
  }

  private async quartoInspect(
    inspectPath: string,
  ): Promise<QuartoInspectOutput> {
    const { stdout } = await execFileAsync("quarto", ["inspect", inspectPath], {
      timeout: 30_000,
    });
    return new QuartoInspectOutput(stdout);
  }

  private async configFromInspect(
    baseDir: string,
    inspectPath: string,
  ): Promise<PartialConfig | undefined> {
    let inspectOutput: QuartoInspectOutput;
    try {
      inspectOutput = await this.quartoInspect(inspectPath);
      logger.debug(`[quarto] quarto inspect succeeded for ${inspectPath}`);
    } catch (err: unknown) {
      const expected = isExpectedInspectFailure(err);
      const log = expected ? logger.debug : logger.warn;
      log(
        `[quarto] quarto inspect failed for ${inspectPath}, attempting fallback: ${err}`,
      );
      const fallbackCfg = await this.genNonInspectConfig(baseDir, inspectPath);
      if (fallbackCfg) {
        logger.info(
          `[quarto] generated configuration without quarto binary inspection: ${inspectPath}`,
        );
      } else {
        log(
          `[quarto] could not identify Quarto project by files context: ${inspectPath}`,
        );
      }
      return fallbackCfg;
    }

    const relEntrypoint =
      inspectPath === baseDir ? "." : path.basename(inspectPath);

    const cfg: PartialConfig = {
      type: ContentType.QUARTO_STATIC,
      entrypoint: relEntrypoint,
    };

    cfg.title = inspectOutput.getTitle(relEntrypoint);

    // Determine content type: shiny or static
    if (
      isQuartoShiny(inspectOutput.htmlMetadata) ||
      isQuartoShiny(inspectOutput.revealjsMetadata)
    ) {
      logger.info(`[quarto] detected Quarto Shiny content: ${relEntrypoint}`);
      cfg.type = ContentType.QUARTO_SHINY;
    }

    // Detect language needs
    let needR = false;
    let needPython = false;

    const isDir = inspectPath === baseDir;
    if (!isDir) {
      if (inspectPath.endsWith(".ipynb")) {
        needPython = true;
      } else {
        try {
          const content = await fs.readFile(inspectPath, "utf-8");
          const langs = detectMarkdownLanguagesInContent(content);
          needR = langs.needsR;
          needPython = langs.needsPython;
        } catch (err: unknown) {
          logger.debug(
            `[quarto] could not read file for language detection: ${inspectPath}: ${err}`,
          );
        }
      }
    }

    const engines = [...inspectOutput.engines];
    if (needPython || this.needsPython(inspectOutput)) {
      cfg.python = {};
      if (!engines.includes("jupyter")) {
        engines.push("jupyter");
      }
    }
    if (needR || this.needsR(inspectOutput)) {
      cfg.r = {};
      if (!engines.includes("knitr")) {
        engines.push("knitr");
      }
    }
    engines.sort();

    cfg.quarto = {
      version: inspectOutput.version,
      engines,
    };

    // Include project files
    cfg.files = await this.collectProjectFiles(baseDir, cfg, inspectOutput);

    // Discover linked resources (images, stylesheets, etc.)
    const discoveredAssets = await findLinkedResources(baseDir, cfg.files);
    cfg.files.push(...discoveredAssets);

    // Include static alternative for non-Shiny content
    if (cfg.type !== ContentType.QUARTO_SHINY) {
      const alt = await this.buildStaticAlternative(
        baseDir,
        cfg,
        inspectOutput,
      );
      if (alt) {
        logger.debug(
          `[quarto] generated static alternative with entrypoint: ${alt.entrypoint}`,
        );
        cfg.alternatives = [alt];
      }
    }

    return cfg;
  }

  private needsPython(inspectOutput: QuartoInspectOutput): boolean {
    if (inspectOutput.engines.includes("jupyter")) {
      return true;
    }
    for (const script of inspectOutput.prePostRenderFiles()) {
      if (script.toLowerCase().endsWith(".py")) {
        return true;
      }
    }
    return false;
  }

  private needsR(inspectOutput: QuartoInspectOutput): boolean {
    if (inspectOutput.engines.includes("knitr")) {
      return true;
    }
    for (const script of inspectOutput.prePostRenderFiles()) {
      if (script.toLowerCase().endsWith(".r")) {
        return true;
      }
    }
    return false;
  }

  private async collectProjectFiles(
    baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): Promise<string[]> {
    const files: string[] = [];

    for (const inputFile of inspectOutput.projectRequiredFiles()) {
      const relPath = path.isAbsolute(inputFile)
        ? path.relative(baseDir, inputFile)
        : inputFile;

      // Skip files within _extensions directory (handled separately)
      if (relPath.startsWith("_extensions")) {
        continue;
      }
      files.push(`/${relPath}`);
    }

    await this.includeSpecialYmlFiles(baseDir, files, cfg);
    await this.includeExtensionsDir(baseDir, files);

    return files;
  }

  private async includeSpecialYmlFiles(
    baseDir: string,
    files: string[],
    cfg: PartialConfig,
  ): Promise<void> {
    for (const filename of specialYmlFiles) {
      const filePath = path.join(baseDir, filename);
      try {
        await fs.access(filePath);
        files.push(`/${filename}`);
        // Update entrypoint to keep the original _quarto.* file
        if (cfg.entrypoint === ".") {
          cfg.entrypoint = filename;
        }
      } catch {
        // File doesn't exist — not an error, just skip
      }
    }
  }

  private async includeExtensionsDir(
    baseDir: string,
    files: string[],
  ): Promise<void> {
    const extensionsDir = path.join(baseDir, "_extensions");
    try {
      const stat = await fs.stat(extensionsDir);
      if (stat.isDirectory()) {
        logger.debug("[quarto] including _extensions directory");
        files.push("/_extensions");
      }
    } catch (err: unknown) {
      logger.debug(`[quarto] could not check _extensions directory: ${err}`);
    }
  }

  // Builds an HTML alternative config that represents the pre-rendered static
  // output of a Quarto project. Two strategies are tried:
  //   1. If the project declares an output-dir (e.g. "_site"), point at that
  //      directory and resolve the HTML entrypoint within it.
  //   2. Otherwise, derive HTML filenames from the input file list (e.g.
  //      "doc.qmd" → "doc.html").
  private async buildStaticAlternative(
    baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): Promise<PartialConfig | undefined> {
    const ext = path.extname(cfg.entrypoint).toLowerCase();
    // Script entrypoints (.R, .py) don't produce standalone HTML output
    if (ext === ".r" || ext === ".py") {
      return undefined;
    }

    const outputDir = inspectOutput.outputDir();
    if (outputDir) {
      return this.staticConfigFromOutputDir(baseDir, cfg, inspectOutput);
    }

    return await this.staticConfigFromFilesLookup(baseDir, cfg, inspectOutput);
  }

  // Strategy 1: The project has an explicit output-dir (e.g. "_site" for
  // website projects). The whole directory is included as a file entry, and
  // the HTML entrypoint is resolved differently depending on whether the
  // source entrypoint is a directory/yaml config or a regular file.
  private staticConfigFromOutputDir(
    baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): PartialConfig | undefined {
    const outputDir = inspectOutput.outputDir();

    const staticCfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "",
      title: cfg.title,
      source: this.renderSource(cfg),
      files: [`/${outputDir}`],
    };

    // For directory/yaml entrypoints, find an index or first input file
    if (isQuartoYaml(cfg.entrypoint) || cfg.entrypoint === ".") {
      const indexFile = inspectOutput.indexHTMLFilepath(baseDir);
      if (indexFile) {
        const relIndex = path.relative(baseDir, indexFile);
        staticCfg.entrypoint = path.join(outputDir, relIndex);
      } else {
        const htmlFiles = inspectOutput.htmlPathsFromInputList(baseDir);
        if (htmlFiles.length > 0) {
          const firstHtml = htmlFiles[0];
          if (firstHtml) {
            const relFirst = path.relative(baseDir, firstHtml);
            staticCfg.entrypoint = path.join(outputDir, relFirst);
          }
        }
      }
    } else {
      // Standard entrypoint: compute its HTML version in output dir
      const stem = path.basename(cfg.entrypoint, path.extname(cfg.entrypoint));
      staticCfg.entrypoint = path.join(outputDir, stem + ".html");
    }

    return staticCfg;
  }

  // Strategy 2: No output-dir declared. Derive HTML filenames directly from
  // the input file list by replacing each file's extension with ".html".
  // The first input file becomes the entrypoint.
  private async staticConfigFromFilesLookup(
    baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): Promise<PartialConfig | undefined> {
    const files: string[] = [];
    let entrypoint = "";

    const inputFiles = inspectOutput.inputFiles();
    for (const file of inputFiles) {
      const stem = path.basename(file, path.extname(file));
      const htmlFile = stem + ".html";

      if (!entrypoint) {
        entrypoint = htmlFile;
      }
      files.push(`/${htmlFile}`);

      // Include any accompanying *_files directory for each HTML file.
      const htmlAbsPath = path.join(baseDir, htmlFile);
      const assetsDir = await inspectOutput.fileAssetsDir(htmlAbsPath);
      if (assetsDir) {
        const relAssetsDir = path.relative(baseDir, assetsDir);
        logger.debug(`[quarto] including companion directory: ${relAssetsDir}`);
        files.push(`/${relAssetsDir}`);
      }
    }

    if (files.length === 0) {
      return undefined;
    }

    const discoveredAssets = await findLinkedResources(baseDir, files);
    files.push(...discoveredAssets);

    return {
      type: ContentType.HTML,
      entrypoint,
      title: cfg.title,
      source: this.renderSource(cfg),
      files,
    };
  }

  private renderSource(cfg: PartialConfig): string {
    if (cfg.entrypoint === ".") {
      return "_quarto.yml";
    }
    return cfg.entrypoint;
  }

  private async findEntrypoints(baseDir: string): Promise<string[]> {
    const results = await Promise.all(
      quartoSuffixes.map((suffix) =>
        globDir(baseDir, "*" + suffix, { nocase: true }),
      ),
    );

    return results.flat();
  }

  private async genNonInspectConfig(
    baseDir: string,
    inspectPath: string,
  ): Promise<PartialConfig | undefined> {
    // Check if _quarto.yml or _quarto.yaml exists
    let quartoYmlExists = false;
    for (const name of ["_quarto.yml", "_quarto.yaml"]) {
      try {
        await fs.access(path.join(baseDir, name));
        quartoYmlExists = true;
        break;
      } catch {
        // doesn't exist
      }
    }

    const ext = path.extname(inspectPath).toLowerCase();
    if (
      !quartoYmlExists &&
      ext !== ".qmd" &&
      ext !== ".ipynb" &&
      ext !== ".rmd"
    ) {
      return undefined;
    }

    const relEntrypoint =
      inspectPath === baseDir ? "." : path.basename(inspectPath);

    logger.debug(
      `[quarto] attempting fallback file-based detection for ${relEntrypoint}`,
    );

    const files: string[] = [];
    const cfg: PartialConfig = {
      type: ContentType.QUARTO_STATIC,
      entrypoint: relEntrypoint,
      quarto: {
        version: defaultQuartoVersion,
      },
      files,
    };

    // Standalone Jupyter notebooks need Python and the jupyter engine
    if (ext === ".ipynb") {
      cfg.python = {};
      cfg.quarto = { version: defaultQuartoVersion, engines: ["jupyter"] };
      files.push(`/${relEntrypoint}`);
      const assets = await findLinkedResources(baseDir, files);
      files.push(...assets);
      return cfg;
    }

    // Standalone RMarkdown files need R and the knitr engine
    if (ext === ".rmd") {
      cfg.r = {};
      cfg.quarto = { version: defaultQuartoVersion, engines: ["knitr"] };
      files.push(`/${relEntrypoint}`);
      const assets = await findLinkedResources(baseDir, files);
      files.push(...assets);
      return cfg;
    }

    // Include .qmd files
    const qmdFiles = await globDir(baseDir, "*.qmd");
    for (const qmdPath of qmdFiles) {
      const relPath = path.basename(qmdPath);
      files.push(`/${relPath}`);
    }

    // Include special yml files
    await this.includeSpecialYmlFiles(baseDir, files, cfg);

    const assets = await findLinkedResources(baseDir, files);
    files.push(...assets);

    return cfg;
  }
}
