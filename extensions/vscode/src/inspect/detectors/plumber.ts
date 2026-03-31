// Copyright (C) 2026 by Posit Software, PBC.

import * as path from "path";
import * as fs from "fs/promises";
import * as yaml from "js-yaml";
import { ContentType } from "src/api/types/configurations";
import { ContentTypeDetector, PartialConfig } from "../types";

interface PlumberServerMetadata {
  engine?: string;
  routes?: string | string[];
  // Note: "constructor" is a reserved property in JS, so we access it
  // via bracket notation on the parsed YAML object.
}

const possiblePlumberEntrypoints = ["plumber.r", "entrypoint.r"];
const possiblePlumberServerFiles = ["_server.yml", "_server.yaml"];

export class PlumberDetector implements ContentTypeDetector {
  async inferType(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig[]> {
    if (entrypoint) {
      const lcEntrypoint = entrypoint.toLowerCase();
      const ext = path.extname(entrypoint);
      if (ext !== ".R" && !possiblePlumberServerFiles.includes(lcEntrypoint)) {
        return [];
      }
    }

    // First try to infer by the existence of _server.y(a)ml for plumber2 projects.
    const configByServer = await this.inferByServerFile(baseDir, entrypoint);
    if (configByServer) {
      return [configByServer];
    }

    // Next, try to infer by the existence of a traditional plumber API entrypoint file.
    const configByEntrypoint = await this.inferByEntrypoint(
      baseDir,
      entrypoint,
    );
    if (configByEntrypoint) {
      return [configByEntrypoint];
    }

    return [];
  }

  private async inferByServerFile(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig | undefined> {
    const result = await this.findServerFile(baseDir);
    if (!result) {
      return undefined;
    }

    const { serverFile, metadata } = result;

    if (!metadata.engine || !metadata.engine.includes("plumber")) {
      return undefined;
    }

    const files = [`/${serverFile}`];
    this.includeServerYmlFiles(files, metadata);

    return {
      type: ContentType.R_PLUMBER,
      entrypoint: entrypoint ?? "",
      files,
      r: {},
    };
  }

  private includeServerYmlFiles(
    files: string[],
    metadata: PlumberServerMetadata,
  ): void {
    // Access "constructor" via bracket notation to avoid Object.prototype.constructor
    const constructorFile = (metadata as unknown as Record<string, unknown>)[
      "constructor"
    ];
    if (typeof constructorFile === "string" && constructorFile !== "") {
      files.push(`/${constructorFile}`);
    }

    if (typeof metadata.routes === "string" && metadata.routes !== "") {
      files.push(`/${metadata.routes}`);
    } else if (Array.isArray(metadata.routes)) {
      for (const routeFile of metadata.routes) {
        if (typeof routeFile === "string" && routeFile !== "") {
          files.push(`/${routeFile}`);
        }
      }
    }
  }

  private async findServerFile(
    baseDir: string,
  ): Promise<
    { serverFile: string; metadata: PlumberServerMetadata } | undefined
  > {
    for (const serverFile of possiblePlumberServerFiles) {
      const serverFilePath = path.join(baseDir, serverFile);
      try {
        const content = await fs.readFile(serverFilePath, "utf-8");
        const metadata = yaml.load(content) as PlumberServerMetadata;
        if (metadata && typeof metadata === "object") {
          return { serverFile, metadata };
        }
      } catch {
        // File doesn't exist or can't be parsed
        continue;
      }
    }
    return undefined;
  }

  private async inferByEntrypoint(
    baseDir: string,
    entrypoint?: string,
  ): Promise<PartialConfig | undefined> {
    // When no entrypoint specified, search for known entrypoints
    if (!entrypoint) {
      // We need to find any of the possible entrypoints
      for (const possibleEntrypoint of possiblePlumberEntrypoints) {
        // Need to find a case-insensitive match in the directory
        const found = await this.findCaseInsensitiveFile(
          baseDir,
          possibleEntrypoint,
        );
        if (found) {
          return {
            type: ContentType.R_PLUMBER,
            entrypoint: found,
            files: [`/${found}`],
            r: {},
          };
        }
      }
      return undefined;
    }

    // With a specified entrypoint, check if it matches known entrypoints
    if (!possiblePlumberEntrypoints.includes(entrypoint.toLowerCase())) {
      return undefined;
    }

    const fullPath = path.join(baseDir, entrypoint);
    try {
      await fs.access(fullPath);
    } catch {
      return undefined;
    }

    return {
      type: ContentType.R_PLUMBER,
      entrypoint,
      files: [`/${entrypoint}`],
      r: {},
    };
  }

  private async findCaseInsensitiveFile(
    baseDir: string,
    lcFilename: string,
  ): Promise<string | undefined> {
    try {
      const entries = await fs.readdir(baseDir);
      for (const entry of entries) {
        if (entry.toLowerCase() === lcFilename) {
          const fullPath = path.join(baseDir, entry);
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            return entry;
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    return undefined;
  }
}
