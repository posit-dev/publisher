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
  readonly entrypoint: string;
  readonly renderedEntrypoint: string;
  readonly projectDir: string;

  constructor(
    filesApi: FilesApi,
    entrypoint: string,
    renderedEntrypoint: string,
    projectDir: string,
  ) {
    this.filesApi = filesApi;
    this.entrypoint = entrypoint;
    this.renderedEntrypoint = renderedEntrypoint;
    this.projectDir = projectDir;
  }

  async verifyRenderedOutput() {
    const filesResponse = await this.filesApi.get();
    const renderingExists = this.renderedEntrypointExists(
      filesResponse.data.files,
    );
    if (!renderingExists) {
      // No renderings, we'll help out rendering, if possible
      return this.render();
    }
  }

  async render() {
    const quartoAvaliable = await this.isQuartoAvailable();
    if (!quartoAvaliable) {
      // Quarto is not available on the system,
      // just return and let the user continue, nothing we can do
      return Promise.reject(new ErrorNoQuarto());
    }

    try {
      // If project rendering succeeds, stop and continue
      await this.renderProject();
      return;
    } catch {
      // Rendering the project failed, could possibly be that this is not a project,
      // meaning a _quarto.yml configuration missing.
    }

    try {
      // The user might have standalone .qmd document that can be rendered,
      // we'll try that out.
      await this.renderDocument();
    } catch {
      // Definitely could not render.
      // Surface the first encountered error as it may provide better details.
      return Promise.reject(new ErrorQuartoRender());
    }
  }

  async isQuartoAvailable(): Promise<boolean> {
    try {
      await runTerminalCommand("quarto --version");
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }

  renderedEntrypointExists(files: ContentRecordFile[]): boolean {
    let fullEntryPath = this.renderedEntrypoint;
    if (this.projectDir !== ".") {
      fullEntryPath = path.join(this.projectDir, this.renderedEntrypoint);
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
    const fullEntryPath = path.join(this.projectDir, this.entrypoint);
    const command = `quarto render ${fullEntryPath} --to html`;
    return runTerminalCommand(command);
  }
}
