import * as path from "path";
import { Uri, window, workspace } from "vscode";
import { fileExists, isDir } from "./files";

export async function getPythonInterpreterPath(): Promise<string | undefined> {
  const configuration = workspace.getConfiguration("python");
  const configuredPython = configuration.get<string>("defaultInterpreterPath");
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

function substituteVariables(s: string, recursive: boolean = false) {
  // Based on https://github.com/DominicVonk/vscode-variables/blob/main/index.js
  // which is Copyright (c) 2021 Dominic Vonk
  // and licensed under the MIT License.
  // Including it here because the NPM package is way
  // out of date and triggers npm audit messages.

  let workspaces = workspace.workspaceFolders || [];
  let workspaceFolder = workspace.workspaceFolders?.length
    ? workspace.workspaceFolders[0]
    : null;
  let activeFile = window.activeTextEditor?.document;
  let absoluteFilePath = activeFile?.uri.fsPath || "";
  s = s.replace(/\${workspaceFolder}/g, workspaceFolder?.uri.fsPath || "");
  s = s.replace(/\${workspaceFolderBasename}/g, workspaceFolder?.name || "");
  s = s.replace(/\${file}/g, absoluteFilePath);
  let activeWorkspace = workspaceFolder;
  let relativeFilePath = absoluteFilePath;
  for (let workspace of workspaces) {
    if (
      absoluteFilePath.replace(workspace.uri.fsPath, "") !== absoluteFilePath
    ) {
      activeWorkspace = workspace;
      relativeFilePath = absoluteFilePath
        .replace(workspace.uri.fsPath, "")
        .substr(path.sep.length);
      break;
    }
  }
  let parsedPath = path.parse(absoluteFilePath);
  s = s.replace(/\${fileWorkspaceFolder}/g, activeWorkspace?.uri.fsPath || "");
  s = s.replace(/\${relativeFile}/g, relativeFilePath);
  s = s.replace(
    /\${relativeFileDirname}/g,
    relativeFilePath.substr(0, relativeFilePath.lastIndexOf(path.sep)),
  );
  s = s.replace(/\${fileBasename}/g, parsedPath.base);
  s = s.replace(/\${fileBasenameNoExtension}/g, parsedPath.name);
  s = s.replace(/\${fileExtname}/g, parsedPath.ext);
  s = s.replace(
    /\${fileDirname}/g,
    parsedPath.dir.substr(parsedPath.dir.lastIndexOf(path.sep) + 1),
  );
  s = s.replace(/\${cwd}/g, parsedPath.dir);
  s = s.replace(/\${pathSeparator}/g, path.sep);
  // s = s.replace(/\${lineNumber}/g, vscode.window.activeTextEditor.selection.start.line + 1);
  // s = s.replace(/\${selectedText}/g, vscode.window.activeTextEditor.document.getText(new vscode.Range(vscode.window.activeTextEditor.selection.start, vscode.window.activeTextEditor.selection.end)));
  s = s.replace(/\${env:(.*?)}/g, function (variable) {
    const m = variable.match(/\${env:(.*?)}/);
    if (m === null) {
      return "";
    }
    return process.env[m[1]] || "";
  });
  s = s.replace(/\${config:(.*?)}/g, function (variable) {
    const m = variable.match(/\${config:(.*?)}/);
    if (m === null) {
      return "";
    }
    return workspace.getConfiguration().get(m[1], "");
  });

  if (
    recursive &&
    s.match(
      /\${(workspaceFolder|workspaceFolderBasename|fileWorkspaceFolder|relativeFile|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|cwd|pathSeparator|lineNumber|selectedText|env:(.*?)|config:(.*?))}/,
    )
  ) {
    s = substituteVariables(s, recursive);
  }
  return s;
}
