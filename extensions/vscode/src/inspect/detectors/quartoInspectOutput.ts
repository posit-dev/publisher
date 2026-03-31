// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";

interface QuartoMetadata {
  title?: string;
  runtime?: string;
  server?: unknown; // string or { type: string }
}

interface QuartoProjectConfig {
  project?: {
    type?: string;
    title?: string;
    "pre-render"?: string[];
    "post-render"?: string[];
    "output-dir"?: string;
  };
  website?: {
    title?: string;
  };
}

interface QuartoFilesData {
  input?: string[];
  configResources?: string[];
}

/**
 * Parsed output from `quarto inspect <path>`.
 * Only the fields we use are included; the rest are
 * discarded by the JSON parser.
 */
export interface QuartoInspectData {
  quarto?: {
    version?: string;
  };
  dir?: string;
  project?: {
    dir?: string;
    config?: QuartoProjectConfig;
    files?: QuartoFilesData;
  };
  engines?: string[];
  files?: QuartoFilesData;
  formats?: {
    html?: {
      metadata?: QuartoMetadata;
      pandoc?: {
        "output-file"?: string;
      };
    };
    revealjs?: {
      metadata?: QuartoMetadata;
      pandoc?: {
        "output-file"?: string;
      };
    };
  };
  fileInformation?: Record<
    string,
    {
      metadata?: {
        resource_files?: string[];
      };
    }
  >;
  config?: QuartoProjectConfig;
}

/**
 * Helper class wrapping the parsed `quarto inspect` JSON output.
 * Provides accessor methods that handle the fact that fields can appear
 * in different locations depending on whether the inspection was run
 * against a directory or a single file.
 */
export class QuartoInspectOutput {
  readonly data: QuartoInspectData;

  constructor(jsonOutput: string) {
    this.data = JSON.parse(jsonOutput) as QuartoInspectData;
  }

  get version(): string {
    return this.data.quarto?.version ?? "";
  }

  get engines(): string[] {
    return this.data.engines ?? [];
  }

  get htmlMetadata(): QuartoMetadata {
    return this.data.formats?.html?.metadata ?? {};
  }

  get revealjsMetadata(): QuartoMetadata {
    return this.data.formats?.revealjs?.metadata ?? {};
  }

  outputDir(): string {
    return (
      this.data.project?.config?.project?.["output-dir"] ??
      this.data.config?.project?.["output-dir"] ??
      ""
    );
  }

  inputFiles(): string[] {
    if (this.data.files?.input) {
      return this.data.files.input;
    }
    if (this.data.project?.files?.input) {
      return this.data.project.files.input;
    }
    if (this.data.fileInformation) {
      return Object.keys(this.data.fileInformation);
    }
    return [];
  }

  configResources(): string[] {
    if (this.data.project?.files?.configResources) {
      return this.data.project.files.configResources;
    }
    if (this.data.files?.configResources) {
      return this.data.files.configResources;
    }
    return [];
  }

  fileInfoResources(): string[] {
    if (!this.data.fileInformation) {
      return [];
    }
    const result: string[] = [];
    for (const fileInfo of Object.values(this.data.fileInformation)) {
      const resourceFiles = fileInfo.metadata?.resource_files;
      if (resourceFiles) {
        for (const rf of resourceFiles) {
          if (!result.includes(rf)) {
            result.push(rf);
          }
        }
      }
    }
    return result;
  }

  prePostRenderFiles(): string[] {
    const files: string[] = [];
    const projectConfig = this.data.config?.project;
    const altProjectConfig = this.data.project?.config?.project;
    if (projectConfig?.["pre-render"]) {
      files.push(...projectConfig["pre-render"]);
    }
    if (altProjectConfig?.["pre-render"]) {
      files.push(...altProjectConfig["pre-render"]);
    }
    if (projectConfig?.["post-render"]) {
      files.push(...projectConfig["post-render"]);
    }
    if (altProjectConfig?.["post-render"]) {
      files.push(...altProjectConfig["post-render"]);
    }
    return files;
  }

  projectRequiredFiles(): string[] {
    return [
      ...this.inputFiles(),
      ...this.configResources(),
      ...this.fileInfoResources(),
      ...this.prePostRenderFiles(),
    ];
  }

  getTitle(entrypointName: string): string {
    const isValidTitle = (title?: string): title is string =>
      title !== undefined && title !== "" && title !== entrypointName;

    if (isValidTitle(this.data.formats?.html?.metadata?.title)) {
      return this.data.formats.html!.metadata!.title!;
    }
    if (isValidTitle(this.data.formats?.revealjs?.metadata?.title)) {
      return this.data.formats.revealjs!.metadata!.title!;
    }
    if (isValidTitle(this.data.config?.website?.title)) {
      return this.data.config.website!.title!;
    }
    if (isValidTitle(this.data.config?.project?.title)) {
      return this.data.config.project!.title!;
    }
    if (isValidTitle(this.data.project?.config?.website?.title)) {
      return this.data.project.config!.website!.title!;
    }
    if (isValidTitle(this.data.project?.config?.project?.title)) {
      return this.data.project.config!.project!.title!;
    }
    return "";
  }

  /**
   * Generate a list of HTML file paths corresponding to the input files.
   */
  htmlPathsFromInputList(baseDir: string): string[] {
    return this.inputFiles().map((file) => {
      const abs = path.isAbsolute(file) ? file : path.join(baseDir, file);
      const dir = path.dirname(abs);
      const stem = path.basename(abs, path.extname(abs));
      return path.join(dir, stem + ".html");
    });
  }

  /**
   * Find an index.html from the input files.
   */
  indexHTMLFilepath(baseDir: string): string | undefined {
    for (const file of this.inputFiles()) {
      if (file.includes("index.")) {
        const abs = path.isAbsolute(file) ? file : path.join(baseDir, file);
        const dir = path.dirname(abs);
        const stem = path.basename(abs, path.extname(abs));
        return path.join(dir, stem + ".html");
      }
    }
    return undefined;
  }
}
