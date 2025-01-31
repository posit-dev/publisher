// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, commands, workspace } from "vscode";
import { fileExists, isDir } from "./files";
import { delay } from "./throttle";
import { substituteVariables } from "./variables";
import { LanguageRuntimeMetadata, PositronApi } from "positron";
import {
  NewPythonExecutable,
  PythonExecutable,
  NewRExecutable,
  RExecutable,
} from "src/types/shared";

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

export async function getPreferredRuntimeFromPositron(
  languageId: string,
): Promise<string | undefined> {
  const api = getPositronApi();

  if (api) {
    let runtime: LanguageRuntimeMetadata | undefined;

    // Small number of retries, because getPreferredRuntime
    // has its own internal retry logic.
    const retries = 3;
    const retryInterval = 1000;

    for (let i = 0; i < retries + 1; i++) {
      try {
        runtime = await api.runtime.getPreferredRuntime(languageId);
        break;
      } catch (error: unknown) {
        // Delay and retry
        console.error(
          "getPreferredRuntime for %s returned an error; retrying. %s",
          languageId,
          error,
        );
        await delay(retryInterval);
      }
    }

    if (runtime) {
      const interpreter = runtime.runtimePath;
      console.log("Using selected %s interpreter: %s", languageId, interpreter);
      return interpreter;
    }
    console.log(
      "Positron getPreferredRuntime for %s did not return a value",
      languageId,
    );
  }
  return undefined;
}

async function getPythonInterpreterFromVSCode(): Promise<PythonExecutable> {
  const workspaceFolder = workspace.workspaceFolders?.[0];
  if (workspaceFolder === undefined) {
    return NewPythonExecutable("");
  }
  let configuredPython: string | undefined;
  try {
    configuredPython = await commands.executeCommand<string>(
      "python.interpreterPath",
      { workspaceFolder: workspaceFolder },
    );
  } catch (error: unknown) {
    console.error(
      "getPythonInterpreterFromPath was unable to execute command. Error = ",
      error,
    );
  }
  if (configuredPython === undefined) {
    return NewPythonExecutable("");
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
    for (const name of names) {
      const candidate = Uri.joinPath(pythonUri, name);
      if (await fileExists(candidate)) {
        python = candidate.fsPath;
      }
    }
  }
  console.log("Python interpreter from vscode:", python);
  return NewPythonExecutable(python);
}

export async function getPythonInterpreterPath(): Promise<PythonExecutable> {
  const pythonPath = await getPreferredRuntimeFromPositron("python");
  if (pythonPath !== undefined) {
    console.log("Using selected Python interpreter", pythonPath);
    return NewPythonExecutable(pythonPath);
  }
  const pythonExecutable = await getPythonInterpreterFromVSCode();
  if (pythonExecutable !== undefined) {
    console.log("Using Python from VSCode", pythonExecutable.pythonPath);
    return pythonExecutable;
  }
  // We don't know the interpreter path.
  // The backend will run Python from PATH.
  console.log("Python interpreter discovery unsuccessful.");
  return NewPythonExecutable("");
}

export async function getRInterpreterPath(): Promise<RExecutable> {
  const rPath = await getPreferredRuntimeFromPositron("r");
  if (rPath !== undefined) {
    console.log("Using selected R interpreter", rPath);
    return NewRExecutable(rPath);
  }
  // We don't know the interpreter path.
  // The backend will run R from PATH.
  console.log("R interpreter discovery unsuccessful.");
  return NewRExecutable("");
}
