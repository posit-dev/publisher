import { workspace } from "vscode";

export function getPythonInterpreterPath(): string {
  const configuration = workspace.getConfiguration("python");
  const python = configuration.get<string>("defaultInterpreterPath");
  console.log("Python interpreter path:", python);
  return python || "";
}
