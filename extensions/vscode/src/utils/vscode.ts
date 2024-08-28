// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, commands, workspace } from "vscode";
import { fileExists, isDir } from "./files";
import { delay } from "./throttle";
import { substituteVariables } from "./variables";
import { LanguageRuntimeMetadata, PositronApi } from "positron";

export async function getPythonInterpreterPath(): Promise<string | undefined> {
  const workspaceFolder = workspace.workspaceFolders?.[0];
  if (workspaceFolder === undefined) {
    return undefined;
  }
  let configuredPython: string | undefined;
  try {
    configuredPython = await commands.executeCommand<string>(
      "python.interpreterPath",
      { workspaceFolder: workspaceFolder },
    );
  } catch {}
  if (configuredPython === undefined) {
    return undefined;
  }
  let python = substituteVariables(configuredPython, true);
  const pythonUri = Uri.file(python);

  if (await isDir(pythonUri)) {
    // Configured python can be a directory such as a virtual environment.
    const names = [
      "bin/python",
      "bin/python3",
      "Scripts/python.exe",
      "Scripts/python3.exe",
    ];
    for (let name of names) {
      const candidate = Uri.joinPath(pythonUri, name);
      if (await fileExists(candidate)) {
        python = candidate.fsPath;
      }
    }
  }
  console.log("Python interpreter path:", python);
  return python;
}

declare global {
  function acquirePositronApi(): PositronApi;
}

let positronApi: PositronApi | null | undefined;

function getPositronApi(): PositronApi | null {
  if (positronApi === undefined) {
    try {
      positronApi = acquirePositronApi();
    } catch {
      positronApi = null;
    }
  }
  return positronApi;
}

export async function getRInterpreterPath(): Promise<string | undefined> {
  const api = getPositronApi();

  if (api) {
    let runtime: LanguageRuntimeMetadata | undefined;

    // Small number of retries, because getPreferredRuntime
    // has its own internal retry logic.
    const retries = 3;
    const retryInterval = 1000;

    for (let i = 0; i < retries + 1; i++) {
      try {
        runtime = await api.runtime.getPreferredRuntime("r");
        break;
      } catch (error: any) {
        // Delay and retry
        console.error(
          "getPreferredRuntime returned an error; retrying. ",
          error,
        );
        await delay(retryInterval);
      }
    }

    if (runtime) {
      const interpreter = runtime.runtimePath;
      console.log("Using selected R interpreter", interpreter);
      return interpreter;
    } else {
      console.log(
        "Using default R interpreter because getPreferredRuntime did not return one",
      );
    }
  }
  // We don't know the interpreter path.
  // The backend will run R from PATH.
  console.log(
    "Using default R interpreter because the Positron API is not available",
  );
  return undefined;
}
