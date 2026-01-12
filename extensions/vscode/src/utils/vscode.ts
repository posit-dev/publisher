// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, commands, workspace } from "vscode";
import { fileExists, isDir } from "./files";
import { delay } from "./throttle";
import { substituteVariables } from "./variables";
import { LanguageRuntimeMetadata, PositronApi } from "positron";
import { PythonExecutable, RExecutable } from "src/types/shared";

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

async function getPythonInterpreterFromVSCode(): Promise<string | undefined> {
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
  } catch (error: unknown) {
    console.error(
      "getPythonInterpreterFromPath was unable to execute command. Error = ",
      error,
    );
  }
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
    for (const name of names) {
      const candidate = Uri.joinPath(pythonUri, name);
      if (await fileExists(candidate)) {
        python = candidate.fsPath;
      }
    }
  }
  console.log("Python interpreter from vscode:", python);
  return python;
}

export async function getPythonInterpreterPath(): Promise<
  PythonExecutable | undefined
> {
  let python: string | undefined;
  python = await getPreferredRuntimeFromPositron("python");
  if (python !== undefined) {
    console.log("Using selected Python interpreter", python);
    return new PythonExecutable(python);
  }
  python = await getPythonInterpreterFromVSCode();
  if (python !== undefined) {
    console.log("Using Python from VSCode", python);
    return new PythonExecutable(python);
  }
  // We don't know the interpreter path.
  // The backend will run Python from PATH.
  console.log("Python interpreter discovery unsuccessful.");
  return python;
}

/**
 * Gets the platform-specific OS type key used by the R extension configuration.
 */
function getRPathConfigKey(): string {
  const platform = process.platform;
  switch (platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "mac";
    default:
      return "linux";
  }
}

/**
 * Attempts to get the R interpreter path from VS Code's R extension configuration.
 * The R extension stores platform-specific paths under r.rpath.{windows,mac,linux}.
 */
async function getRInterpreterFromVSCode(): Promise<string | undefined> {
  const osType = getRPathConfigKey();
  const rPath = workspace.getConfiguration("r.rpath").get<string>(osType);

  if (rPath === undefined || rPath === "") {
    return undefined;
  }

  const rUri = Uri.file(rPath);
  if (await fileExists(rUri)) {
    console.log("R interpreter from vscode r.rpath config:", rPath);
    return rPath;
  }

  console.log("R path from config does not exist:", rPath);
  return undefined;
}

/**
 * Attempts to find R in the system PATH environment variable.
 */
async function getRInterpreterFromPath(): Promise<string | undefined> {
  const platform = process.platform;
  const splitChr = platform === "win32" ? ";" : ":";
  const rBin = platform === "win32" ? "R.exe" : "R";

  const pathEnv = process.env.PATH;
  if (!pathEnv) {
    return undefined;
  }

  for (const envPath of pathEnv.split(splitChr)) {
    if (!envPath) {
      continue;
    }
    const rBinUri = Uri.joinPath(Uri.file(envPath), rBin);
    if (await fileExists(rBinUri)) {
      console.log("R interpreter from PATH:", rBinUri.fsPath);
      return rBinUri.fsPath;
    }
  }

  return undefined;
}

export async function getRInterpreterPath(): Promise<RExecutable | undefined> {
  let r: string | undefined;

  r = await getPreferredRuntimeFromPositron("r");
  if (r !== undefined) {
    console.log("Using selected R interpreter from Positron", r);
    return new RExecutable(r);
  }

  r = await getRInterpreterFromVSCode();
  if (r !== undefined) {
    console.log("Using R from VSCode config", r);
    return new RExecutable(r);
  }

  r = await getRInterpreterFromPath();
  if (r !== undefined) {
    console.log("Using R from PATH", r);
    return new RExecutable(r);
  }

  // We don't know the interpreter path.
  // The backend will run R from PATH.
  console.log("R interpreter discovery unsuccessful.");
  return undefined;
}
