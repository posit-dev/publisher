// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";
import { globDir } from "../helpers/globDir";
import { detectMarkdownLanguagesInContent } from "../helpers/markdownLanguages";
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

const defaultQuartoVersion = "1.7.34";

const quartoSuffixes = [".qmd", ".Rmd", ".ipynb", ".R", ".py", ".jl"];

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
    (metadata.server as Record<string, unknown>)["type"] === "shiny"
  ) {
    return true;
  }
  return false;
}

function isQuartoYaml(entrypointBase: string): boolean {
  return ["_quarto.yml", "_quarto.yaml"].includes(entrypointBase);
}

export class QuartoDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    // When the chosen entrypoint is _quarto.yml, quarto inspect doesn't handle it well
    // but an inspection to the base directory will bring what the user expects.
    if (entrypoint && isQuartoYaml(path.basename(entrypoint))) {
      const cfg = await this.configFromInspect(baseDir, baseDir);
      if (cfg) {
        // Override entrypoint to the directory dot (will be resolved later)
        cfg.entrypoint = ".";
        return [cfg];
      }
    }

    if (entrypoint) {
      const ext = path.extname(entrypoint);
      if (!quartoSuffixes.includes(ext)) {
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
    } catch {
      // quarto inspect failed — try fallback file-based detection
      return this.genNonInspectConfig(baseDir, inspectPath);
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
        } catch {
          // Can't read the file for language detection
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

    // Include static alternative for non-Shiny content
    if (cfg.type !== ContentType.QUARTO_SHINY) {
      const alt = this.buildStaticAlternative(baseDir, cfg, inspectOutput);
      if (alt) {
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
      if (script.endsWith(".py")) {
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
      if (script.endsWith(".R")) {
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
        // File doesn't exist
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
        files.push("/_extensions");
      }
    } catch {
      // Doesn't exist
    }
  }

  private buildStaticAlternative(
    baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): PartialConfig | undefined {
    const ext = path.extname(cfg.entrypoint);
    // Don't generate static config for script entrypoints
    if (ext === ".R" || ext === ".py") {
      return undefined;
    }

    const outputDir = inspectOutput.outputDir();
    if (outputDir) {
      return this.staticConfigFromOutputDir(baseDir, cfg, inspectOutput);
    }

    return this.staticConfigFromFilesLookup(baseDir, cfg, inspectOutput);
  }

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
          const relFirst = path.relative(baseDir, htmlFiles[0]!);
          staticCfg.entrypoint = path.join(outputDir, relFirst);
        }
      }
    } else {
      // Standard entrypoint: compute its HTML version in output dir
      const stem = path.basename(cfg.entrypoint, ext(cfg.entrypoint));
      staticCfg.entrypoint = path.join(outputDir, stem + ".html");
    }

    return staticCfg;
  }

  private staticConfigFromFilesLookup(
    _baseDir: string,
    cfg: PartialConfig,
    inspectOutput: QuartoInspectOutput,
  ): PartialConfig | undefined {
    const staticCfg: PartialConfig = {
      type: ContentType.HTML,
      entrypoint: "",
      title: cfg.title,
      source: this.renderSource(cfg),
      files: [],
    };

    const inputFiles = inspectOutput.inputFiles();
    for (const file of inputFiles) {
      const stem = path.basename(file, path.extname(file));
      const htmlFile = stem + ".html";

      if (!staticCfg.entrypoint) {
        staticCfg.entrypoint = htmlFile;
      }
      staticCfg.files!.push(`/${htmlFile}`);
    }

    if (staticCfg.files!.length > 0) {
      return staticCfg;
    }
    return undefined;
  }

  private renderSource(cfg: PartialConfig): string {
    if (cfg.entrypoint === ".") {
      return "_quarto.yml";
    }
    return cfg.entrypoint;
  }

  private async findEntrypoints(baseDir: string): Promise<string[]> {
    const allPaths: string[] = [];
    for (const suffix of quartoSuffixes) {
      const paths = await globDir(baseDir, "*" + suffix);
      allPaths.push(...paths);
    }
    return allPaths;
  }

  private async genNonInspectConfig(
    baseDir: string,
    inspectPath: string,
  ): Promise<PartialConfig | undefined> {
    // Check if _quarto.yml exists
    let quartoYmlExists = false;
    try {
      await fs.access(path.join(baseDir, "_quarto.yml"));
      quartoYmlExists = true;
    } catch {
      // doesn't exist
    }

    const ext = path.extname(inspectPath);
    if (
      !quartoYmlExists &&
      ext !== ".qmd" &&
      ext !== ".ipynb" &&
      ext !== ".Rmd"
    ) {
      return undefined;
    }

    const relEntrypoint =
      inspectPath === baseDir ? "." : path.basename(inspectPath);

    const cfg: PartialConfig = {
      type: ContentType.QUARTO_STATIC,
      entrypoint: relEntrypoint,
      quarto: {
        version: defaultQuartoVersion,
      },
      files: [],
    };

    // Standalone Jupyter notebooks need Python and the jupyter engine
    if (ext === ".ipynb") {
      cfg.python = {};
      cfg.quarto!.engines = ["jupyter"];
      cfg.files!.push(`/${relEntrypoint}`);
      return cfg;
    }

    // Standalone RMarkdown files need R and the knitr engine
    if (ext === ".Rmd") {
      cfg.r = {};
      cfg.quarto!.engines = ["knitr"];
      cfg.files!.push(`/${relEntrypoint}`);
      return cfg;
    }

    // Include .qmd files
    const qmdFiles = await globDir(baseDir, "*.qmd");
    for (const qmdPath of qmdFiles) {
      const relPath = path.basename(qmdPath);
      cfg.files!.push(`/${relPath}`);
    }

    // Include special yml files
    await this.includeSpecialYmlFiles(baseDir, cfg.files!, cfg);

    return cfg;
  }
}

function ext(filename: string): string {
  return path.extname(filename);
}
