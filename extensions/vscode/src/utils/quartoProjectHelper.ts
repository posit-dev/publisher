// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileExistsAt } from "./fsUtils";
import { resolveQuartoBinary } from "./quartoBinary";
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

// Leave the bare "quarto" command alone; quote absolute paths (e.g.
// Positron's bundled binary) in case they contain spaces.
function shellQuoteBinary(quarto: string): string {
  return path.isAbsolute(quarto) ? `"${quarto}"` : quarto;
}

export class QuartoProjectHelper {
  readonly source: string;
  readonly renderedEntrypoint: string;
  readonly projectDir: string;

  constructor(source: string, renderedEntrypoint: string, projectDir: string) {
    this.source = source;
    this.renderedEntrypoint = renderedEntrypoint;
    this.projectDir = projectDir;
  }

  async render() {
    const quartoAvaliable = await this.isQuartoBinAvailable();
    if (!quartoAvaliable) {
      return Promise.reject(new ErrorNoQuarto());
    }

    const quarto = await resolveQuartoBinary();
    const isProject = await this.isQuartoYmlPresent();
    try {
      if (isProject) {
        await this.renderProject(quarto);
      } else {
        await this.renderDocument(quarto);
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
      await execFileAsync(await resolveQuartoBinary(), ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  renderProject(quarto = "quarto") {
    const command = `${shellQuoteBinary(quarto)} render "${this.projectDir}"`;
    return runTerminalCommand(command);
  }

  renderDocument(quarto = "quarto") {
    const fullEntryPath = path.join(this.projectDir, this.source);
    const command = `${shellQuoteBinary(quarto)} render "${fullEntryPath}"`;
    return runTerminalCommand(command);
  }
}
