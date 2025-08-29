// Copyright (C) 2025 by Posit Software, PBC.

import * as path from "path";
import { AxiosResponse } from "axios";
import { ContentRecordFile } from "../api/types/files";
import { runTerminalCommand } from "./window";

interface FilesApi {
  get: () => Promise<AxiosResponse<ContentRecordFile>>;
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
    if (renderingExists) {
      // Existing renderings present, do nothing
      return;
    }

    // No renderings, we'll help out rendering, if possible
    try {
      await this.isQuartoAvailable();
    } catch (_) {
      // Quarto is not available on the system,
      // let the user continue, nothing we can do
      return;
    }

    try {
      // If project rendering succeeds, stop and continue
      await this.renderProject();
      return;
    } catch (_) {
      // Rendering the project failed, could possibly be that this is not a project,
      // meaning a _quarto.yml configuration missing.
      // But the user might have standalone .qmd document that can be rendered,
      // we'll try that out.
    }

    try {
      await this.renderDocument();
    } catch (_) {
      return Promise.reject();
    }
  }

  isQuartoAvailable(): Promise<void> {
    return runTerminalCommand("quarto --version");
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
    return runTerminalCommand(command, true);
  }

  renderDocument() {
    const command = `quarto render ${this.entrypoint} --to html`;
    return runTerminalCommand(command, true);
  }
}
