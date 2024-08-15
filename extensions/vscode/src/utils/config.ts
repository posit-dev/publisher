// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, commands, workspace } from "vscode";
import { fileExists, isDir } from "./files";
import { substituteVariables } from "./variables";
import { PositronApi } from "positron";

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
    const runtime = await api.runtime.getPreferredRuntime("r");
    if (runtime) {
      return runtime.runtimePath;
    }
  }
  // We don't know the interpreter path.
  // The backend will run R from PATH.
  return undefined;
}
