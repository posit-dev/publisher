// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { AxiosResponse } from "axios";
import { ContentRecordFile } from "../api/types/files";
import { runTerminalCommand } from "./window";

interface FilesApi {
  get: () => Promise<AxiosResponse<ContentRecordFile>>;
}

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
  readonly filesApi: FilesApi;
  readonly source: string;
  readonly renderedEntrypoint: string;
  readonly projectDir: string;

  constructor(
    filesApi: FilesApi,
    source: string,
    renderedEntrypoint: string,
    projectDir: string,
  ) {
    this.filesApi = filesApi;
    this.source = source;
    this.renderedEntrypoint = renderedEntrypoint;
    this.projectDir = projectDir;
  }

  async render() {
    const quartoAvaliable = await this.isQuartoBinAvailable();
    if (!quartoAvaliable) {
      // Quarto is not available on the system,
      // just return and let the user continue, nothing we can do
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

  async isQuartoYmlPresent() {
    if (this.source.includes("_quarto.yml")) {
      return true;
    }
    const filesResponse = await this.filesApi.get();
    return this.fileExistsInProjectDir(filesResponse.data.files, "_quarto.yml");
  }

  async isQuartoBinAvailable(): Promise<boolean> {
    try {
      await runTerminalCommand("quarto --version");
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  fileExistsInProjectDir(
    files: ContentRecordFile[],
    filename: string,
  ): boolean {
    let fullEntryPath = filename;
    if (this.projectDir !== ".") {
      fullEntryPath = path.join(this.projectDir, filename);
    }

    // Split the full rendered entrypoint path to lookup for the rendering
    const pathSplit = fullEntryPath.split(path.sep);

    // Path consists of only the filename,
    // then, look for the rendering on the first level of files.
    if (pathSplit.length === 1) {
      return files.some((file) => file.id === pathSplit[0]);
    }

    // Rendered entrypoint is nested in workspace directory levels
    const fileToFind = pathSplit.pop();
    const foundFile = this.findFile(files, pathSplit, fileToFind!);
    return Boolean(foundFile);
  }

  findFile(
    filesTree: ContentRecordFile[],
    dirsChain: string[],
    fileToFind: string,
  ): ContentRecordFile | void {
    if (!dirsChain.length) {
      return filesTree.find((file) => file.id === fileToFind);
    }

    const dirChainLink = dirsChain.shift();
    for (const branch of filesTree) {
      if (branch.id === dirChainLink) {
        return this.findFile(branch.files, dirsChain, fileToFind);
      }
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
