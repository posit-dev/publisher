// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileExistsAt } from "./fsUtils";
import { runTerminalCommand } from "./window";

const execFileAsync = promisify(execFile);

export class ErrorNoQuarto extends Error {
  constructor() {
    super("Could not find Quarto binary on the system.");
    this.name = "ErrorNoQuarto";
  }
}

export class ErrorQuartoRender extends Error {
  constructor() {
    super("Could not render Quarto project.");
    this.name = "ErrorQuartoRender";
  }
}

export class QuartoProjectHelper {
  readonly source: string;
  readonly renderedEntrypoint: string;
  readonly projectDir: string;

  /**
   * @param source - Source entrypoint filename (e.g. "index.qmd")
   * @param renderedEntrypoint - Rendered output filename (e.g. "index.html")
   * @param projectDir - Project directory (may be relative)
   * @param rootDir - If provided, projectDir is resolved against this root to
   *   produce an absolute path. This ensures filesystem checks and quarto
   *   render commands work correctly regardless of the extension host's cwd.
   */
  constructor(
    source: string,
    renderedEntrypoint: string,
    projectDir: string,
    rootDir?: string,
  ) {
    this.source = source;
    this.renderedEntrypoint = renderedEntrypoint;
    this.projectDir = rootDir ? path.resolve(rootDir, projectDir) : projectDir;
  }

  async render() {
    const quartoAvaliable = await this.isQuartoBinAvailable();
    if (!quartoAvaliable) {
      return Promise.reject(new ErrorNoQuarto());
    }

    const isProject = await this.isQuartoYmlPresent();
    try {
      if (isProject) {
        await this.renderProject();
      } else {
        await this.renderDocument();
      }
    } catch {
      return Promise.reject(new ErrorQuartoRender());
    }
  }

  async isQuartoYmlPresent(): Promise<boolean> {
    if (this.source.includes("_quarto.yml")) {
      return true;
    }
    const quartoYmlPath = path.join(this.projectDir, "_quarto.yml");
    return await fileExistsAt(quartoYmlPath);
  }

  async isQuartoBinAvailable(): Promise<boolean> {
    try {
      await execFileAsync("quarto", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  renderProject() {
    const command = `quarto render "${this.projectDir}"`;
    return runTerminalCommand(command);
  }

  renderDocument() {
    const fullEntryPath = path.join(this.projectDir, this.source);
    const command = `quarto render "${fullEntryPath}"`;
    return runTerminalCommand(command);
  }
}
