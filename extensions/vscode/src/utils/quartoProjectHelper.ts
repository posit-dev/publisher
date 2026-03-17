// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { fileExistsAt } from "../interpreters/fsUtils";
import { runTerminalCommand } from "./window";

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
      await runTerminalCommand("quarto --version");
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  renderProject() {
    const command = `quarto render ${this.projectDir} --to html`;
    return runTerminalCommand(command);
  }

  renderDocument() {
    const fullEntryPath = path.join(this.projectDir, this.source);
    const command = `quarto render ${fullEntryPath} --to html`;
    return runTerminalCommand(command);
  }
}
