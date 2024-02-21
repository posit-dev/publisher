import * as vscode from 'vscode';

export const path = (): string | undefined => {
  return vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath;
};
